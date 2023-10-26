import { Trans } from '@lingui/macro'
import { Percent } from '@uniswap/sdk-core'
import { InterfaceTrade } from 'state/routing/types'
import styled from 'styled-components'
import { ButtonText } from 'theme/components'

import { RowBetween, RowFixed } from '../Row'
import SettingsTab from '../Settings'
import SwapBuyFiatButton from './SwapBuyFiatButton'

const StyledSwapHeader = styled(RowBetween)`
  margin-bottom: 10px;
  color: ${({ theme }) => theme.neutral2};
`

const HeaderButtonContainer = styled(RowFixed)`
  padding: 0 12px;
  gap: 16px;
`

const StyledTextButton = styled(ButtonText)`
  color: ${({ theme }) => theme.neutral2};
  gap: 4px;
  font-weight: 485;
  &:focus {
    text-decoration: none;
  }
  &:active {
    text-decoration: none;
  }
`

export enum SwapTab {
  Swap = 'swap',
  LimitOrder = 'limit_order',
}

export default function SwapHeader({
  autoSlippage,
  chainId,
  trade,
  onClickTab,
}: {
  autoSlippage: Percent
  chainId?: number
  trade?: InterfaceTrade
  onClickTab: (newTab: SwapTab) => void
}) {
  return (
    <StyledSwapHeader>
      <HeaderButtonContainer>
        <StyledTextButton onClick={() => onClickTab(SwapTab.Swap)}>
          <Trans>Swap</Trans>
        </StyledTextButton>
        <SwapBuyFiatButton />
        <StyledTextButton onClick={() => onClickTab(SwapTab.LimitOrder)}>
          <Trans>Limit order</Trans>
        </StyledTextButton>
      </HeaderButtonContainer>
      <RowFixed>
        <SettingsTab autoSlippage={autoSlippage} chainId={chainId} trade={trade} />
      </RowFixed>
    </StyledSwapHeader>
  )
}
