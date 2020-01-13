import {Resource} from '..';

const SID_REGEX = /^[a-z0-9\-\_]{7,14}$/i;

export default function shortIdPlugin(resource: Resource, {sidKey = '_sid'} = {}) {
  // const handle = (key: string, value: string) => {

  // };

  // resource.addUrl((key, value) => {

  // })

  resource.addIdentifierHandler(
    (_sid: string) => SID_REGEX.test(_sid),
    (_sid: string) => ({_sid})
  );

  // resource.pre('id', (key: string, value: string, filter: {[s: string]: any}) => {
  //   const isMatch = key === '0' && SID_REGEX.test(value);
  //   return isMatch ? {[sidKey]: toString(value)} : null;
  // });
}
