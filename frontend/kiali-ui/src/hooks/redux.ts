import { useDispatch, useSelector } from 'react-redux';
import { KialiAppState } from '../store/Store';
import { KialiDispatch } from '../types/Redux';

export function useKialiDispatch() {
  return useDispatch<KialiDispatch>();
}

export function useKialiSelector<TSelected = unknown>(
  selector: (state: KialiAppState) => TSelected,
  equalityFn?: (left: TSelected, right: TSelected) => boolean
) {
  return useSelector<KialiAppState, TSelected>(selector, equalityFn);
}
