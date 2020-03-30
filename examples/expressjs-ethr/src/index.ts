import express from 'express'
import * as Daf from 'daf-core'
import * as SD from 'daf-selective-disclosure'
import * as W3C from 'daf-w3c'
import { app, server, io, sessionStore } from './server'
import { core, dataStore, initializeDb } from './framework'
import { getIdentity, setServiceEndpoint } from './identity'

if (!process.env.HOST) throw Error('Environment variable HOST not set')
if (!process.env.PORT) throw Error('Environment variable PORT not set')

async function main() {
  await initializeDb()
  const identity = await getIdentity()

  const messagingEndpoint = '/handle-message'
  const serviceEndpoint = process.env.HOST + messagingEndpoint

  const result = await setServiceEndpoint(identity, serviceEndpoint)
  if (!result) {
    throw Error('Service endpoint not published. You probably need to send some ETH to ' + identity.did)
  }

  app.post(messagingEndpoint, express.text({ type: '*/*' }), async (req, res) => {
    try {
      // This will trigger Daf.EventTypes.validatedMessage
      const result = await core.handleMessage({ raw: req.body })
      res.json({ id: result.id })
    } catch (e) {
      res.send(e.message)
    }
  })

  core.on(Daf.EventTypes.savedMessage, async (message: Daf.Message) => {
    if (message.type === W3C.MessageTypes.vp && message.threadId) {
      // TODO check for required vcs

      const sessionId = message.threadId
      io.in(sessionId).emit('loggedin', { did: message.from?.did })

      sessionStore.get(sessionId, (error, session) => {
        if (error) throw Error(error)

        if (session) {
          session.did = message.from?.did
          sessionStore.set(sessionId, session)
        }
      })
    }
  })

  const requireLogin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.session) throw Error('Session not configured')
    if (!req.session.did) {
      res.redirect('/login')
    } else {
      next()
    }
  }

  app.get('/', requireLogin, async (req, res) => {
    res.redirect('/home')
  })

  app.get('/home', requireLogin, async (req, res) => {
    if (!req.session) throw Error('Session not configured')

    // Counting views to show that session is working
    req.session.views = req.session.views ? req.session.views + 1 : 1

    const { did, views } = req.session
    const name = await dataStore.shortId(did)
    res.render('home', { did, views, name })
  })

  app.get('/history', requireLogin, async (req, res) => {
    if (!req.session) throw Error('Session not configured')

    // Counting views to show that session is working
    req.session.views = req.session.views ? req.session.views + 1 : 1

    const { did, views } = req.session
    const name = await dataStore.shortId(did)
    const messages = await dataStore.findMessages({ sender: did })
    console.log(messages)
    res.render('history', { did, views, name, messages })
  })

  app.get('/login', async (req, res) => {
    if (!req.session) throw Error('Session not configured')

    // Counting views to show that session is working
    req.session.views = req.session.views ? req.session.views + 1 : 1

    // Sign Selective Disclosure Request
    const jwt = await core.handleAction({
      type: SD.ActionTypes.signSdr,
      did: identity.did,
      data: {
        tag: req.sessionID,
        claims: [
          {
            reason: 'We need this information',
            essential: true,
            claimType: 'name',
          },
        ],
      },
    } as SD.ActionSignSdr)

    const url = encodeURI(process.env.HOST + '/?c_i=') + jwt

    res.render('login', { views: req.session.views, url })
  })

  app.get('/credential', requireLogin, async (req, res) => {
    if (!req.session) throw Error('Session not configured')

    // Counting views to show that session is working
    req.session.views = req.session.views ? req.session.views + 1 : 1

    const { did, views } = req.session
    const name = await dataStore.shortId(did)

    // Sign verifiable credential
    const nameJwt = await core.handleAction({
      type: W3C.ActionTypes.signVc,
      did: identity.did,
      data: {
        sub: did,
        vc: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            name,
          },
        },
      },
    } as W3C.ActionSignW3cVc)

    const kwcJwt = await core.handleAction({
      type: W3C.ActionTypes.signVc,
      did: identity.did,
      data: {
        sub: did,
        vc: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            kycId: '123XZY',
          },
        },
      },
    } as W3C.ActionSignW3cVc)

    const vpJwt = await core.handleAction({
      type: W3C.ActionTypes.signVp,
      did: identity.did,
      data: {
        aud: did,
        vp: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiablePresentation'],
          verifiableCredential: [nameJwt, kwcJwt],
        },
      },
    } as W3C.ActionSignW3cVp)

    const url = encodeURI(process.env.HOST + '/?c_i=') + vpJwt

    res.render('credential', { views, url })
  })

  app.get('/about', async (req, res) => {
    if (!req.session) throw Error('Session not configured')

    // Counting views to show that session is working
    req.session.views = req.session.views ? req.session.views + 1 : 1

    const { views } = req.session

    const url = encodeURI(process.env.HOST + '/public-profile')

    res.render('about', { views, url })
  })

  app.get('/public-profile', async (req, res) => {
    // Sign verifiable presentation
    const jwt = await core.handleAction({
      type: W3C.ActionTypes.signVc,
      did: identity.did,
      data: {
        sub: identity.did,
        vc: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            name: 'DAF Demo',
            description: 'Demo application',
            profileImage: 'https://i.imgur.com/IMn3dIg.png',
          },
        },
      },
    } as W3C.ActionSignW3cVc)

    res.send(jwt)
  })

  app.get('/logout', (req, res) => req.session?.destroy(() => res.redirect('/')))

  server.listen(process.env.PORT, async () => {
    console.log(`Server running at http://localhost:${process.env.PORT}/`)
    console.log(`Messaging service endpoint ${serviceEndpoint}`)
  })
}

main().catch(e => console.log(e.message))
