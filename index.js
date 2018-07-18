const EventEmitter = require('events').EventEmitter;
const XStreem = require('xstreem');

function deepClone(obj) {
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (err) {
        throw new Error('Not JSON stringable value: ' + obj)
    }
}

class Lagan extends EventEmitter {

    constructor({ initialState = {}, logFile, position = 0 }) {

        super();
        
        this._eventstream = new XStreem(logFile);
        this._events = {};
        this._listeners = {};

        this._initialState = deepClone(initialState);
        this._state = deepClone(initialState);

        this._position = position;

        this._listener = (...args) => this._eventHandler(...args);
        this._eventstream.listen(this._position, this._listener);
    }

    _eventHandler(pos, event, meta) {

        if (pos !== this._position) {
            // Maybe silly to check for this. It just should never happen.
            throw new Error('Major internal error: Events arrives in wrong order.')
        }

        const responseId = [meta.checksum, meta.host, meta.pid, meta.nonce, meta.time].join('-');

        if (typeof this._events[event.type] === 'undefined') {
            if (typeof this._listeners[responseId] !== 'undefined') {
                this._listeners[responseId](new Error('No projector registered for this kind of event.'));
            }
            this._position++;
            return;
        }

        try {
            this._state = deepClone(this._events[event.type](event.props, deepClone(this._state)));
        } catch (err) {
            if (typeof this._listeners[responseId] !== 'undefined') {
                this._listeners[responseId](err);
            }
            this._position++;
            return;
        }

        if (typeof this._listeners[responseId] !== 'undefined') {
            this._listeners[responseId](null);
        }

        this._position++;
    }

    event(type, props) {
        return {
            apply: () => {
                const event = { type, props: deepClone(props) };
                return new Promise((resolve, reject) => resolve())
                .then(() => {
                    let resolve, reject;
                    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
                    const meta = this._eventstream.add(event, { returnMeta: true });
                    const responseId = [meta.checksum, meta.host, meta.pid, meta.nonce, meta.time].join('-');
                    this._listeners[responseId] = (err) => {
                        delete this._listeners[responseId];
                        if (err) reject(err);
                        resolve();
                    };
                    return promise;
                });
            },
            type,
            props: deepClone(props)
        }
    }

    registerEvent(eventType, projectorFn) {
        if (typeof this._events[eventType] !== 'undefined') throw new Error('Event type already registered: ' + eventType);
        this._events[eventType] = projectorFn;
    }

    stop() {
        this._eventstream.removeListener(this._listener);
    }

    get initialState() {
        return deepClone(this._initialState);
    }

    get logFile() {
        return this._eventstream.filename;
    }

    get position() {
        return this._position;
    }

    get state() {
        return deepClone(this._state);
    }

} 

module.exports = Lagan;