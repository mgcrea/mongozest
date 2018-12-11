import {Resource} from '..';

const SID_REGEX = /^[a-z0-9\-\_]{7,14}$/i;

export default function shortIdPlugin(resource: Resource, {sidKey = '_sid'} = {}) {
  resource.addFilterUrlParams({
    [sidKey]: SID_REGEX
  });
}
