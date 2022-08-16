import { TAgent, IMessageHandler } from '@veramo/core'
import { IDidEthrMetaTransactionPlugin } from '../../src/types/IDidEthrMetaTransactionPlugin'

type ConfiguredAgent = TAgent<IDidEthrMetaTransactionPlugin & IMessageHandler>

export default (testContext: {
  getAgent: () => ConfiguredAgent
  setup: () => Promise<boolean>
  tearDown: () => Promise<boolean>
}) => {
  describe('my plugin', () => {
    let agent: ConfiguredAgent

    beforeAll(() => {
      testContext.setup()
      agent = testContext.getAgent()
    })
    afterAll(testContext.tearDown)

    it('should foo', async () => {
      const result = await agent.addAttribute({
        did: 'did:ethr:rinkeby:0xb09b66026ba5909a7cfe99b76875431d2b8d5190',
        attributeName: 'lorem',
        attributeValue: 'ipsum',
      })
      expect(result).toEqual({ foobar: 'ipsum' })
    })
  })
}
