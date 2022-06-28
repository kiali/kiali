import { createTransform } from 'redux-persist';
import {get, set, unset, pickBy, isEmpty, forIn, cloneDeep} from "lodash"

export function createFilter (reducerName, inboundPaths, outboundPaths, transformType = 'whitelist') {
	return createTransform(
		// inbound
		(inboundState, key) => {
			return inboundPaths
				? persistFilter(inboundState, inboundPaths, transformType)
				: inboundState;
		},

		// outbound
		(outboundState, key) => {
			return outboundPaths
				? persistFilter(outboundState, outboundPaths, transformType)
				: outboundState;
		},

		{'whitelist': [reducerName]}
	);
};

export function createWhitelistFilter (reducerName, inboundPaths, outboundPaths) {
	return createFilter(reducerName, inboundPaths, outboundPaths, 'whitelist');
}

export function createBlacklistFilter (reducerName, inboundPaths, outboundPaths) {
	return createFilter(reducerName, inboundPaths, outboundPaths, 'blacklist');
}

function filterObject({ path, filterFunction = () => true }, state) {
	const value = get(state, path, state);

	if (value instanceof Array) {
		return value.filter(filterFunction)
	}

	return pickBy(value, filterFunction);
}

export function persistFilter (state, paths = [], transformType = 'whitelist') {
	let subset = {};

	// support only one key
	if (typeof paths === 'string') {
		paths = [paths];
	}

	if (transformType === 'whitelist') {
		paths.forEach((path) => {
			if (typeof path === 'object' && !(path instanceof Array)) {
				const value = filterObject(path, state);

				if (!isEmpty(value)) {
					set(subset, path.path, value);
				}
			} else {
				const value = get(state, path);

				if (typeof value !== 'undefined') {
					set(subset, path, value);
				}
			}
		});
	} else if (transformType === 'blacklist') {
		subset = cloneDeep(state);
		paths.forEach((path) => {
			if (typeof path === 'object' && !(path instanceof Array)) {
				const value = filterObject(path, state);

				if (!isEmpty(value)) {
					if (value instanceof Array) {
						set(subset, path.path, get(subset, path.path, subset).filter((x) => false));
					} else {
						forIn(value, (value, key) => { unset(subset, `${path.path}[${key}]`) });
					}
        } else {
          subset = value;
        }
			} else {
				const value = get(state, path);

				if (typeof value !== 'undefined') {
					unset(subset, path);
				}
			}
		});
	} else {
		subset = state;
	}

	return subset;
}

export default createFilter;