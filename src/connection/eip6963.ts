/* eslint-disable import/no-unused-modules */
import {
  Actions,
  AddEthereumChainParameter,
  Connector,
  Provider,
  ProviderConnectInfo,
  ProviderRpcError,
} from '@web3-react/types'
import { shallowEqual } from 'react-redux'

export function isDataURI(uri: string): boolean {
  return /data:(image\/[-+\w.]+)(;?\w+=[-\w]+)*(;base64)?,.*/gu.test(uri)
}

export interface EIP6963ProviderInfo {
  uuid: string
  name: string
  icon: string
  rdns: string
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo
  provider: Provider
}

export interface EVMProviderDetected extends EIP6963ProviderDetail {
  accounts: string[]
  request?: Provider['request']
}

export interface EIP6963AnnounceProviderEvent extends Event {
  detail: EIP6963ProviderDetail
}

class EIP6963ProviderMap {
  map: Map<string, EVMProviderDetected> = new Map()
  listeners = new Set<() => void>()
  injectorsPresent = false

  constructor() {
    window.addEventListener('eip6963:announceProvider', this.onAnnounceProvider.bind(this) as EventListener)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
  }

  private onAnnounceProvider(event: EIP6963AnnounceProviderEvent) {
    const { rdns, icon, name, uuid } = event.detail?.info ?? {}

    // ignore improperly formatted eip6963 providers
    if (!rdns || !icon || !name || !uuid) return

    this.injectorsPresent = true
    // ignored duplicate announcements
    if (shallowEqual(this.map.get(rdns)?.info, event.detail.info)) return

    this.map.set(rdns, { ...event.detail, accounts: [] })
    this.listeners.forEach((listener) => listener())
  }
}

export const EIP6963_PROVIDER_MAP = new EIP6963ProviderMap()

export class EIP6963Provider implements Provider {
  currentProvider?: EVMProviderDetected
  proxyListeners: { [eventName: string]: (() => void)[] } = {}

  async request(args: any): Promise<unknown> {
    return this.currentProvider?.provider.request(args)
  }

  on(eventName: string, listener: (...args: any[]) => void): this {
    if (!this.proxyListeners[eventName]) {
      this.proxyListeners[eventName] = []
    }
    this.proxyListeners[eventName].push(listener)
    this.currentProvider?.provider.on(eventName, listener)
    return this
  }

  removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.currentProvider?.provider.removeListener(eventName, listener)
    return this
  }

  setCurrentProvider(rdns: string) {
    const oldProvider = this.currentProvider
    const newProvider = (this.currentProvider = EIP6963_PROVIDER_MAP.map.get(rdns))

    for (const eventName in this.proxyListeners) {
      // proxyListener must be referentially stable to prevent memory leaks
      // pull them from proxyListeners to keep them stable
      for (const proxyListener of this.proxyListeners[eventName]) {
        oldProvider?.provider.removeListener(eventName, proxyListener)
        newProvider?.provider.on(eventName, proxyListener)
      }
    }
  }
}

function parseChainId(chainId: string | number) {
  return typeof chainId === 'string' ? Number.parseInt(chainId, 16) : chainId
}

export interface EIP1193ConstructorArgs {
  actions: Actions
  provider: Provider
  onError?: (error: Error) => void
}

export class EIP1193 extends Connector {
  /** {@inheritdoc Connector.provider} */
  provider: Provider

  constructor({ actions, provider, onError }: EIP1193ConstructorArgs) {
    super(actions, onError)

    this.provider = provider

    this.provider.on('connect', ({ chainId }: ProviderConnectInfo): void => {
      this.actions.update({ chainId: parseChainId(chainId) })
    })

    this.provider.on('disconnect', (error: ProviderRpcError): void => {
      this.actions.resetState()
      this.onError?.(error)
    })

    this.provider.on('chainChanged', (chainId: string): void => {
      this.actions.update({ chainId: parseChainId(chainId) })
    })

    this.provider.on('accountsChanged', (accounts: string[]): void => {
      this.actions.update({ accounts })
    })
  }

  /** {@inheritdoc Connector.connectEagerly} */
  public async connectEagerly(): Promise<void> {
    const cancelActivation = this.actions.startActivation()

    try {
      if (!this.provider) return cancelActivation()

      // Wallets may resolve eth_chainId and hang on eth_accounts pending user interaction, which may include changing
      // chains; they should be requested serially, with accounts first, so that the chainId can settle.
      const accounts = (await this.provider.request({ method: 'eth_accounts' })) as string[]
      if (!accounts.length) throw new Error('No accounts returned')
      const chainId = (await this.provider.request({ method: 'eth_chainId' })) as string
      console.log('cartcrom', 'calling update eagerly', { chainId: parseChainId(chainId), accounts })
      this.actions.update({ chainId: parseChainId(chainId), accounts })
    } catch (error) {
      console.debug('Could not connect eagerly', error)
      // we should be able to use `cancelActivation` here, but on mobile, metamask emits a 'connect'
      // event, meaning that chainId is updated, and cancelActivation doesn't work because an intermediary
      // update has occurred, so we reset state instead
      this.actions.resetState()
    }
  }

  public async activate(desiredChainIdOrChainParameters?: number | AddEthereumChainParameter): Promise<void> {
    // const cancelActivation = this.actions.startActivation()
    console.log('cartcrom', 'activate', desiredChainIdOrChainParameters)

    // eslint-disable-next-line no-constant-condition
    // if (1) return

    try {
      // if (!this.provider) throw new NoMetaMaskError()

      // Wallets may resolve eth_chainId and hang on eth_accounts pending user interaction, which may include changing
      // chains; they should be requested serially, with accounts first, so that the chainId can settle.
      const accounts = (await this.provider.request({ method: 'eth_requestAccounts' })) as string[]
      const chainId = (await this.provider.request({ method: 'eth_chainId' })) as string
      const receivedChainId = parseChainId(chainId)
      const desiredChainId =
        typeof desiredChainIdOrChainParameters === 'number'
          ? desiredChainIdOrChainParameters
          : desiredChainIdOrChainParameters?.chainId

      console.log('cartcrom', { accounts, receivedChainId, desiredChainId })

      // if there's no desired chain, or it's equal to the received, update
      if (!desiredChainId || receivedChainId === desiredChainId) {
        console.log('cartcrom', 'calling update1', { chainId: receivedChainId, accounts })
        return this.actions.update({ chainId: receivedChainId, accounts })
      }
      const desiredChainIdHex = `0x${desiredChainId.toString(16)}`

      // if we're here, we can try to switch networks
      return this.provider
        .request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: desiredChainIdHex }],
        })
        .catch((error: ProviderRpcError) => {
          // https://github.com/MetaMask/metamask-mobile/issues/3312#issuecomment-1065923294
          const errorCode = (error.data as any)?.originalError?.code || error.code

          // 4902 indicates that the chain has not been added to MetaMask and wallet_addEthereumChain needs to be called
          // https://docs.metamask.io/guide/rpc-api.html#wallet-switchethereumchain
          if (errorCode === 4902 && typeof desiredChainIdOrChainParameters !== 'number') {
            if (!this.provider) throw new Error('No provider')
            // if we're here, we can try to add a new network
            return this.provider.request({
              method: 'wallet_addEthereumChain',
              params: [{ ...desiredChainIdOrChainParameters, chainId: desiredChainIdHex }],
            })
          }
          throw error
        })
        .then(() => this.activate(desiredChainId))
    } catch (error) {
      // cancelActivation?.()
      console.log(error)
      throw error
    }
  }
}
