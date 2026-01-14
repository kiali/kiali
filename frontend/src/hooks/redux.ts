import { useDispatch, useSelector } from 'react-redux';
import { KialiAppState } from '../store/Store';
import { KialiDispatch } from '../types/Redux';

export const useKialiDispatch = (): KialiDispatch => {
  return useDispatch<KialiDispatch>();
};

export const useKialiSelector = <TSelected = unknown>(
  selector: (state: KialiAppState) => TSelected,
  equalityFn?: (left: TSelected, right: TSelected) => boolean
): TSelected => {
  return useSelector<KialiAppState, TSelected>(selector, equalityFn);
};
