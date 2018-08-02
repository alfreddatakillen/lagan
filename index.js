const EventEmitter = require('events').EventEmitter;
const XStreem = require('xstreem');

class Event {
    
    constructor() {}
    
    init(props, position) {
        this.props = props;
        if (typeof position !== 'undefined') {
            this.position = position;
        } else {
            this.position = null;
        }
        this.error = null;
    }
    
    get type() { return this.constructor.name; };

    apply () {
        const event = { type: this.type, props: this.props };

        let resolve, reject;
        const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
        
        try {
            if (typeof this.validate === 'function') {
                this.validate(this._lagan.state, null);
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
        if (typeof this.position === 'number') {
            obj.position = this.position;
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

        this.initialState = initialState;
        this.state = initialState;

        this.position = position;

        this._listener = (...args) => this._eventHandler(...args);
        this._eventstream.listen(this.position, this._listener);

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

        if (pos !== this.position) {
            // Maybe silly to check for this. It just should never happen.
            throw new Error('Major internal error: Events arrives in wrong order.')
        }

        const responseId = [meta.checksum, meta.host, meta.pid, meta.nonce, meta.time].join('-');

        if (typeof this._events[event.type] === 'undefined') {
            if (typeof this._listeners[responseId] !== 'undefined') {
                this._listeners[responseId](new Error('No event class registered with name: ' + event.type));
            }
            this.position++;
            return;
        }

        const eventObj = new this._events[event.type](event.props, this.position);

        let result;
        try {
            if (typeof eventObj.validate === 'function') {
                eventObj.validate(this.state, this.position);
            }
            
            result = eventObj.project(this.state);

        } catch (err) {
            if (typeof this._listeners[responseId] !== 'undefined') {
                eventObj.error = err;
                this._listeners[responseId](err, eventObj);
            }
            this.position++;

            return;
        }

        if (typeof result.then === 'function') {
            this._eventstream.pause();
            result.then(state => {
                this._eventstream.resume();
                this.state = state;

                if (typeof this._listeners[responseId] !== 'undefined') {
                    this._listeners[responseId](null, eventObj);
                }
        
                this.position++;
            })
            .catch(err => {
                if (typeof this._listeners[responseId] !== 'undefined') {
                    eventObj.error = err;
                    this._listeners[responseId](err, eventObj);
                }
                this.position++;
            });
            
        } else {
            this.state = result;

            if (typeof this._listeners[responseId] !== 'undefined') {
                this._listeners[responseId](null, eventObj);
            }
    
            this.position++;
        }

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

    get logFile() {
        return this._eventstream.filename;
    }

} 

module.exports = Lagan;