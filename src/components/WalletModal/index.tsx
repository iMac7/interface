import { useWeb3React } from '@web3-react/core'
import IconButton from 'components/AccountDrawer/IconButton'
import { AutoColumn } from 'components/Column'
import { Settings } from 'components/Icons/Settings'
import { AutoRow } from 'components/Row'
import { connections, deprecatedNetworkConnection, eip6963Connection, networkConnection } from 'connection'
import { ActivationStatus, useActivationState } from 'connection/activate'
import { EIP6963_PROVIDER_MAP } from 'connection/eip6963'
import { getRecentlyUsedInjector } from 'connection/meta'
import { isSupportedChain } from 'constants/chains'
import { useFallbackProviderEnabled } from 'featureFlags/flags/fallbackProvider'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import styled from 'styled-components'
import { ThemedText } from 'theme/components'
import { flexColumnNoWrap } from 'theme/styles'

import ConnectionErrorView from './ConnectionErrorView'
import Option from './Option'
import PrivacyPolicyNotice from './PrivacyPolicyNotice'

const Wrapper = styled.div`
  ${flexColumnNoWrap};
  background-color: ${({ theme }) => theme.surface1};
  width: 100%;
  padding: 14px 16px 16px;
  flex: 1;
`

const OptionGrid = styled.div`
  display: grid;
  grid-gap: 2px;
  border-radius: 12px;
  overflow: hidden;
  ${({ theme }) => theme.deprecated_mediaWidth.deprecated_upToMedium`
    grid-template-columns: 1fr;
  `};
`

const PrivacyPolicyWrapper = styled.div`
  padding: 0 4px;
`

function getOptions() {
  return EIP6963_PROVIDER_MAP.map
}

function subscribe(listener: () => void) {
  EIP6963_PROVIDER_MAP.listeners.add(listener)
  return () => {
    EIP6963_PROVIDER_MAP.listeners.delete(listener)
  }
}

function useInjectedOptions() {
  return useSyncExternalStore(subscribe, getOptions)
}

export default function WalletModal({ openSettings }: { openSettings: () => void }) {
  const { connector, chainId } = useWeb3React()

  const { activationState } = useActivationState()
  const fallbackProviderEnabled = useFallbackProviderEnabled()
  // Keep the network connector in sync with any active user connector to prevent chain-switching on wallet disconnection.
  useEffect(() => {
    if (chainId && isSupportedChain(chainId) && connector !== networkConnection.connector) {
      if (fallbackProviderEnabled) {
        networkConnection.connector.activate(chainId)
      } else {
        deprecatedNetworkConnection.connector.activate(chainId)
      }
    }
  }, [chainId, connector, fallbackProviderEnabled])

  const injectedOptionMap = useInjectedOptions()

  const connectionList = useMemo(() => {
    console.log('cartcrom', 'here', Array.from(injectedOptionMap.values()).length)
    const list: JSX.Element[] = []
    for (const connection of connections) {
      if (connection.shouldDisplay()) list.push(<Option key={connection.getName()} connection={connection} />)
    }

    for (const injector of injectedOptionMap.values()) {
      // The most-recently-used injector should appear as the second in list, other injectors should appear above the last item of the list
      const insertIndex = injector.info.rdns === getRecentlyUsedInjector() ? 1 : list.length - 1

      list.splice(insertIndex, 0, <Option connection={eip6963Connection} eip6963Info={injector.info} />)
    }

    return list
  }, [injectedOptionMap])

  return (
    <Wrapper data-testid="wallet-modal">
      <AutoRow justify="space-between" width="100%" marginBottom="16px">
        <ThemedText.SubHeader>Connect a wallet</ThemedText.SubHeader>
        <IconButton Icon={Settings} onClick={openSettings} data-testid="wallet-settings" />
      </AutoRow>
      {activationState.status === ActivationStatus.ERROR ? (
        <ConnectionErrorView />
      ) : (
        <AutoColumn gap="16px">
          <OptionGrid data-testid="option-grid">{connectionList}</OptionGrid>
          <PrivacyPolicyWrapper>
            <PrivacyPolicyNotice />
          </PrivacyPolicyWrapper>
        </AutoColumn>
      )}
    </Wrapper>
  )
}
