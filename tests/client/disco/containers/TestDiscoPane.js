import React from 'react';
import { Simulate, renderIntoDocument } from 'react-addons-test-utils';
import { findDOMNode } from 'react-dom';
import { Provider } from 'react-redux';
import { discoResults } from 'disco/actions';
import * as discoApi from 'disco/api';
import createStore from 'disco/store';
import {
  EXTENSION_TYPE,
  ON_DISABLE,
  ON_ENABLE,
  ON_INSTALLED,
  ON_INSTALLING,
  ON_UNINSTALLED,
  ON_UNINSTALLING,
  globalEvents,
} from 'disco/constants';
import * as helpers from 'disco/containers/DiscoPane';
import { getFakeI18nInst, MockedSubComponent, stubAddonManager } from 'tests/client/helpers';
import { loadEntities } from 'core/actions';
import I18nProvider from 'core/i18n/Provider';


// Use DiscoPane that isn't wrapped in asyncConnect.
const { DiscoPane } = helpers;


describe('AddonPage', () => {
  function render(props) {
    const store = createStore({
      addons: {foo: {type: EXTENSION_TYPE}},
      discoResults: [{addon: 'foo'}],
    });
    const results = [{addon: 'foo', type: EXTENSION_TYPE}];
    const i18n = getFakeI18nInst();

    // We need the providers for i18n and since InstallButton will pull data from the store.
    return findDOMNode(renderIntoDocument(
      <I18nProvider i18n={i18n}>
        <Provider store={store} key="provider">
          <DiscoPane results={results} i18n={i18n}
            {...props} AddonComponent={MockedSubComponent} />
        </Provider>
      </I18nProvider>
    ));
  }

  describe('video', () => {
    it('is small by default', () => {
      const root = render();
      assert.notOk(root.querySelector('.show-video'));
    });

    it('gets bigger and smaller when clicked', () => {
      const root = render();
      Simulate.click(root.querySelector('.play-video'));
      assert.ok(root.querySelector('.show-video'));
      Simulate.click(root.querySelector('.close-video a'));
      assert.notOk(root.querySelector('.show-video'));
    });
  });

  describe('loadDataIfNeeded', () => {
    it('does nothing if there are loaded results', () => {
      const store = {
        getState() {
          return {addons: {foo: {}}, discoResults: [{addon: 'foo'}]};
        },
      };
      const getAddons = sinon.stub(discoApi, 'getDiscoveryAddons');
      return helpers.loadDataIfNeeded({store})
        .then(() => assert.notOk(getAddons.called));
    });

    it('loads the addons if there are none', () => {
      const api = {the: 'config'};
      const dispatch = sinon.spy();
      const store = {
        dispatch,
        getState() {
          return {addons: {}, api, discoResults: []};
        },
      };
      const entities = {addons: {foo: {slug: 'foo'}}, discoResults: {foo: {addon: 'foo'}}};
      const result = {results: ['foo']};
      const getAddons = sinon.stub(discoApi, 'getDiscoveryAddons')
        .returns(Promise.resolve({entities, result}));
      return helpers.loadDataIfNeeded({store})
        .then(() => {
          assert.ok(getAddons.calledWith({api}));
          assert.ok(dispatch.calledWith(loadEntities(entities)));
          assert.ok(dispatch.calledWith(discoResults([{addon: 'foo'}])));
        });
    });
  });

  describe('mapStateToProps', () => {
    it('only sets results', () => {
      const props = helpers.mapStateToProps({discoResults: []});
      assert.deepEqual(Object.keys(props), ['results']);
    });

    it('sets the results', () => {
      const props = helpers.mapStateToProps({
        addons: {one: {slug: 'one'}, two: {slug: 'two'}},
        discoResults: [{addon: 'two'}],
      });
      assert.deepEqual(props.results, [{slug: 'two', addon: 'two'}]);
    });
  });

  describe('mapDispatchToProps', () => {
    const eventMap = {
      onDisabled: ON_DISABLE,
      onEnabled: ON_ENABLE,
      onInstalling: ON_INSTALLING,
      onInstalled: ON_INSTALLED,
      onUninstalling: ON_UNINSTALLING,
      onUninstalled: ON_UNINSTALLED,
    };

    Object.keys(eventMap).forEach((event) => {
      const action = eventMap[event];
      it(`dispatches ${action}`, () => {
        const dispatch = sinon.spy();
        const { handleGlobalEvent } = helpers.mapDispatchToProps(dispatch);
        const id = 'foo@whatever';
        const needsRestart = false;
        handleGlobalEvent({id, type: event, needsRestart});
        assert(dispatch.calledWith({
          type: action,
          payload: {guid: id, needsRestart},
        }), `Calls ${action} for ${event}`);
      });
    });

    it('throws on unknown event', () => assert.throws(() => {
      const dispatch = sinon.spy();
      const { handleGlobalEvent } = helpers.mapDispatchToProps(dispatch);
      handleGlobalEvent({type: 'whateve'});
    }, Error, /Unknown global event/));

    it('is empty when there is no navigator', () => {
      const configStub = {
        get: sinon.stub().returns(true),
      };
      assert.deepEqual(
        helpers.mapDispatchToProps(sinon.spy(), { _config: configStub }), {});
    });
  });

  describe('componentDidMount', () => {
    it('sets events', () => {
      const fakeAddonManager = stubAddonManager();
      render({mozAddonManager: fakeAddonManager});
      assert.equal(fakeAddonManager.addEventListener.callCount, globalEvents.length);
    });
  });
});
