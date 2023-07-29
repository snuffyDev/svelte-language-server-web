import * as ns from "events/";
export default ns;
const events = { ...ns };
const { EventEmitter, defaultMaxListeners, init, listenerCount, once } = events;
export { EventEmitter, defaultMaxListeners, init, listenerCount, once };
