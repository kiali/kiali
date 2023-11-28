import { AppenderString, TimeInSeconds } from '../types/Common';
import * as AlertUtils from '../utils/AlertUtils';
import { PromisesRegistry } from '../utils/CancelablePromises';
import * as API from './Api';
import { decorateMeshData } from '../store/Selectors/MeshData';
import EventEmitter from 'eventemitter3';
import { createSelector } from 'reselect';
import { DecoratedMeshElements, MeshDefinition, MeshElements, MeshQuery } from 'types/Mesh';

export const EMPTY_MESH_DATA = { nodes: [], edges: [] };
const PROMISE_KEY = 'CURRENT_REQUEST';

// MeshDataSource allows us to have multiple mesh graphs in play, which functionally allows us to maintain
// the master mesh page as well as to offer mini-meshes in the other pages.
//
// NOTE: It is not clear that we we will need anything other than the master mesh page, but this is modeled
// after GraphDataSource. which can't really hurt...
//
// MeshDataSource (GDS) emits events asynchronously and has the potential to disrupt the expected
// react+redux workflow typical of our components.  To avoid unexpected results here are some
// [anti-]patterns for using MeshDataSource:
//   - Do not set up MDS callbacks in nested components.  It is better to process the callbacks in the
//     top-level component and then update props (via react or redux) and let the lower components update normally.
//       - if A embeds B, do not have callbacks for the same MDS in A and B, just A
//   - Avoid accessing MDS fields to access fetch information (elements, timestamps, fetchParameters, etc).  In
//     short, the fields are volatile and can change at unexpected times.
//       - Instead, in the callbacks save what you need to local variables or properties.  Then use them to
//         trigger react/redux state changes normally.
//   - Avoid passing a MDS as a property.
//       - The only reason to do this is for an embedded component to access the MDS fields directly, which is
//         an anti-pattern explained above.  Having said that, if you are SURE the MDS is stable, it will work
//         (at this writing we still do this for mini-meshes).

type EmitEvents = {
  (eventName: 'loadStart', isPreviousDataInvalid: boolean, fetchParams: MeshFetchParams): void;
  (eventName: 'fetchError', errorMessage: string | null, fetchParams: MeshFetchParams): void;
  (
    eventName: 'fetchSuccess',
    meshTimestamp: TimeInSeconds,
    meshData: DecoratedMeshElements,
    fetchParams: MeshFetchParams
  ): void;
};

export interface MeshFetchParams {}

type OnEvents = {
  (eventName: 'loadStart', callback: (isPreviousDataInvalid: boolean, fetchParams: MeshFetchParams) => void): void;
  (eventName: 'fetchError', callback: (errorMessage: string | null, fetchParams: MeshFetchParams) => void): void;
  (
    eventName: 'fetchSuccess',
    callback: (meshTimestamp: TimeInSeconds, meshData: DecoratedMeshElements, fetchParams: MeshFetchParams) => void
  ): void;
};

export class MeshDataSource {
  public meshTimestamp: TimeInSeconds;

  private _errorMessage: string | null;
  private _fetchParams: MeshFetchParams;
  private _isError: boolean;
  private _isLoading: boolean;

  private eventEmitter: EventEmitter;
  private meshElements: MeshElements;
  private promiseRegistry: PromisesRegistry;

  private decoratedData = createSelector(
    (meshData: { meshElements: MeshElements }) => meshData.meshElements,
    meshData => decorateMeshData(meshData)
  );

  // Public methods

  constructor() {
    this.meshElements = EMPTY_MESH_DATA;
    this.meshTimestamp = 0;

    this.eventEmitter = new EventEmitter();
    this.promiseRegistry = new PromisesRegistry();

    this._errorMessage = null;
    this._fetchParams = {};
    this._isError = this._isLoading = false;
  }

  public fetchMeshData = (fetchParams: MeshFetchParams): void => {
    // const previousFetchParams = this.fetchParameters;

    // Copy fetch parameters to a local attribute
    this._fetchParams = { ...fetchParams };

    const restParams: MeshQuery = {};

    // Some appenders are expensive so only specify an appender if needed.
    let appenders: AppenderString = '';

    restParams.appenders = appenders;

    this._isLoading = true;
    this._isError = false;

    const isPreviousDataInvalid = false;
    if (isPreviousDataInvalid) {
      // Reset the mesh data
      this.meshElements = EMPTY_MESH_DATA;
      this.meshTimestamp = 0;
    }

    this.emit('loadStart', isPreviousDataInvalid, fetchParams);

    this.fetchMesh(restParams);
  };

  public on: OnEvents = (eventName: any, callback: any): void => {
    this.eventEmitter.on(eventName, callback);
  };

  public removeListener: OnEvents = (eventName: any, callback: any): void => {
    this.eventEmitter.removeListener(eventName, callback);
  };

  // Some helpers

  // Private methods

  /*
  private static defaultFetchParams(): FetchParams {
    return {};
  }
  */

  private emit: EmitEvents = (eventName: string, ...args: unknown[]) => {
    this.eventEmitter.emit(eventName, ...args);
  };

  private fetchMesh = (restParams: MeshQuery): void => {
    this.promiseRegistry.register(PROMISE_KEY, API.getMesh(restParams)).then(
      response => {
        const responseData: any = response.data;
        this.meshElements = responseData && responseData.elements ? responseData.elements : EMPTY_MESH_DATA;
        this.meshTimestamp = responseData && responseData.timestamp ? responseData.timestamp : 0;
        const decoratedMeshElements = this.meshData;
        this._isLoading = this._isError = false;

        this.emit('fetchSuccess', this.meshTimestamp, decoratedMeshElements, this.fetchParameters);
      },
      error => {
        this._isLoading = false;

        if (error.isCanceled) {
          return;
        }

        this._isError = true;
        this._errorMessage = API.getErrorString(error);
        AlertUtils.addError('Cannot load the mesh', error);
        this.emit('fetchError', `Cannot load the mesh: ${this.errorMessage}`, this.fetchParameters);
      }
    );
  };

  // Getters and setters
  public get meshData(): DecoratedMeshElements {
    return this.decoratedData({ meshElements: this.meshElements });
  }

  public get meshDefinition(): MeshDefinition {
    return {
      elements: this.meshElements,
      timestamp: this.meshTimestamp
    };
  }

  public get errorMessage(): string | null {
    return this._errorMessage;
  }

  public get fetchParameters(): MeshFetchParams {
    return this._fetchParams;
  }

  public get isError(): boolean {
    return this._isError;
  }

  public get isLoading(): boolean {
    return this._isLoading;
  }
}
