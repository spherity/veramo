import { IAgentPlugin } from '@veramo/core'
import {
  IAddAttributeArgs,
  IAddAttributeResult,
  IDidEthrMetaTransactionPlugin,
  IRequiredContext
} from '../types/IDidEthrMetaTransactionPlugin'
import { schema } from '../index'

/**
 * {@inheritDoc DidEthrMetaTransactionPlugin}
 * @beta
 */
export class DidEthrMetaTransactionPlugin implements IAgentPlugin {
  readonly schema = schema.DidProviderEthrMetaPlugin

  // map the methods your plugin is declaring to their implementation
  readonly methods: IDidEthrMetaTransactionPlugin = {
    addAttribute: this.addDelegate.bind(this),
  }

  /** {@inheritDoc DidProviderEthrMetaPlugin.myPluginFoo} */
  private async addDelegate(args: IAddAttributeArgs, context: IRequiredContext): Promise<IAddAttributeResult> {
    // you can call other agent methods (that are declared in the `IRequiredContext`)
    //const didDoc = await context.agent.resolveDid({ didUrl: args.did })
    // or emit some events
    //await context.agent.emit('my-other-event', { foo: 'hello' })
    return { foobar: "" }
  }
}
