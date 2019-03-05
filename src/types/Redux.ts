import { KialiAppState } from '../store/Store';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from '../actions/KialiAppAction';

export type KialiDispatch = ThunkDispatch<KialiAppState, void, KialiAppAction>;
