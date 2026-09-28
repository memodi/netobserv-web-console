import { Button, Flex, FlexItem, Tab, Tabs, TabTitleIcon, TabTitleText, Tooltip } from '@patternfly/react-core';
import { InfoCircleIcon } from '@patternfly/react-icons';
import React, { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useNetflowContext } from '../../model/netflow-context';
import { ViewPresetId } from '../../model/views';
import { TimeRange } from '../../utils/datetime';
import { getPanelFeature } from '../../utils/overview-panels';
import { useTheme } from '../../utils/theme-hook';
import { ViewId } from '../netflow-traffic';

export interface TabsContainerProps {
  selectedViewId: ViewId;
  activeView: ViewPresetId;
  selectView: (v: ViewId) => void;
  showHistogram: boolean;
  setShowViewOptions: (v: boolean) => void;
  setShowHistogram: (v: boolean) => void;
  setHistogramRange: (v: TimeRange | undefined) => void;
  isShowViewOptions: boolean;
  style?: CSSProperties;
}

export const TabsContainer: React.FC<TabsContainerProps> = props => {
  const { t } = useTranslation('plugin__netobserv-plugin');
  const isDarkTheme = useTheme();
  const { caps } = useNetflowContext();
  const isAllowLoki = caps.allowLoki;
  const showGenericPanelsHint =
    props.activeView !== 'all' &&
    caps.selectedPanels.length > 0 &&
    caps.selectedPanels.every(panel => !getPanelFeature(panel.id));

  return (
    <Flex className="netflow-traffic-tabs-container" style={props.style}>
      <FlexItem id="tabs-container" flex={{ default: 'flex_1' }}>
        <Tabs
          className={`netflow-traffic-tabs ${isDarkTheme ? 'dark' : 'light'}`}
          usePageInsets
          activeKey={props.selectedViewId}
          onSelect={(event, eventkey) => props.selectView(eventkey as ViewId)}
          role="region"
        >
          <Tab
            className="overviewTabButton"
            eventKey={'overview'}
            tooltip={
              showGenericPanelsHint ? (
                <Tooltip
                  content={t(
                    'This view shows generic overview panels. Customize your view by selecting more panels under Advanced options → Manage panels.'
                  )}
                />
              ) : undefined
            }
            title={
              <>
                <TabTitleText>{t('Overview')}</TabTitleText>
                {showGenericPanelsHint && (
                  <TabTitleIcon>
                    <InfoCircleIcon aria-hidden="true" />
                  </TabTitleIcon>
                )}
              </>
            }
          />
          <Tab
            className="tableTabButton"
            eventKey={'table'}
            isAriaDisabled={!isAllowLoki} // required instead of 'disabled' when used with a tooltip
            tooltip={
              !isAllowLoki ? (
                <Tooltip content={t('Only available when FlowCollector.loki.enable is true')} />
              ) : undefined
            }
            title={<TabTitleText>{t('Traffic flows')}</TabTitleText>}
          />
          <Tab
            className="topologyTabButton"
            eventKey={'topology'}
            title={<TabTitleText>{t('Topology')}</TabTitleText>}
          />
        </Tabs>
      </FlexItem>
      {props.selectedViewId === 'table' && (
        <FlexItem className={'bottom-border'}>
          <Button
            data-test="show-histogram-button"
            id="show-histogram-button"
            variant="link"
            className="overflow-button"
            onClick={() => {
              props.setShowViewOptions(false);
              props.setShowHistogram(!props.showHistogram);
              props.setHistogramRange(undefined);
            }}
          >
            {props.showHistogram ? t('Hide histogram') : t('Show histogram')}
          </Button>
        </FlexItem>
      )}
      <FlexItem className={'bottom-border'}>
        <Button
          data-test="show-view-options-button"
          id="show-view-options-button"
          variant="link"
          className="overflow-button"
          onClick={() => {
            props.setShowViewOptions(!props.isShowViewOptions);
            props.setShowHistogram(false);
            props.setHistogramRange(undefined);
          }}
        >
          {props.isShowViewOptions ? t('Hide advanced options') : t('Show advanced options')}
        </Button>
      </FlexItem>
    </Flex>
  );
};

export default TabsContainer;
