const EventEmitter = require('events').EventEmitter;
const XStreem = require('xstreem');

function deepClone(obj) {
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (err) {
        throw new Error('Not JSON stringable value: ' + obj)
    }
}

class Event {
    
    constructor() {}
    
    init(props, position) {
        this._props = deepClone(props);
        if (typeof position !== 'undefined') {
            this._position = position;
        } else {
            this._position = null;
        }
        this.error = null;
    }
    
    get position() { return this._position; };
    
    get props() { return deepClone(this._props); };
    
    get type() { return this.constructor.name; };

    apply () {
        const event = { type: this.type, props: this.props };

        let resolve, reject;
        const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
        
        try {
            if (typeof this.validate === 'function') {
                this.validate(deepClone(this._lagan._state), null);
            }
        } catch(error) {
            this.error = error;
            this._lagan.emit('failedPreValidation', event);
            reject(error);
            return promise;
        }

        const meta = this._lagan._eventstream.add(event, { returnMeta: true });
        const responseId = [meta.checksum, meta.host, meta.pid, meta.nonce, meta.time].join('-');
        this._lagan._listeners[responseId] = (error, event) => {
            delete this._lagan._listeners[responseId];
            if (error) {
                this.error = error;
                this._lagan.emit('failedProjection', event);
                reject(error);
                return;
            }
            this._lagan.emit('successfulProjection', event);
            resolve();
        };
        return promise;
    }

    toString() {
        const obj = {
            type: this.type,
            props: this._props
        }
        if (typeof this._position === 'number') {
            obj.position = this._position;
        }
        return JSON.stringify(obj);
    }

};
const eventParent = new Event();

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

        const lagan = this;
        this.Event = function (props, position) {
            if (typeof props === 'undefined') {
                props = {};
            }
            this._lagan = lagan;
            this.init(props, position);
        }
        this.Event.prototype = eventParent;
    }

    _eventHandler(pos, event, meta) {

        if (pos !== this._position) {
            // Maybe silly to check for this. It just should never happen.
            throw new Error('Major internal error: Events arrives in wrong order.')
        }

        const responseId = [meta.checksum, meta.host, meta.pid, meta.nonce, meta.time].join('-');

        if (typeof this._events[event.type] === 'undefined') {
            if (typeof this._listeners[responseId] !== 'undefined') {
                this._listeners[responseId](new Error('No event class registered with name: ' + event.type));
            }
            this._position++;
            return;
        }

        const eventObj = new this._events[event.type](deepClone(event.props, this._position));

        try {
            if (typeof eventObj.validate === 'function') {
                eventObj.validate(deepClone(this._state), this.position);
            }
            
            this._state = deepClone(eventObj.project(deepClone(this._state)));

        } catch (err) {
            if (typeof this._listeners[responseId] !== 'undefined') {
                event.error = err;
                this._listeners[responseId](err, eventObj);
            }
            this._position++;

            return;
        }


        if (typeof this._listeners[responseId] !== 'undefined') {
            this._listeners[responseId](null, eventObj);
        }

        this._position++;
    }

    registerEvent(EventClass) {
        const eventObj = new EventClass({});
        const eventType = eventObj.type;
        if (typeof this._events[eventType] !== 'undefined') throw new Error('Event type already registered: ' + eventType);
        this._events[eventType] = EventClass;
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