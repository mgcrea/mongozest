// import {configure} from 'enzyme';
// import Adapter from 'enzyme-adapter-react-16';

// configure({adapter: new Adapter()});

import console from 'console';

global.d = (obj: any) => console.dir(obj, {colors: true, depth: 10});
