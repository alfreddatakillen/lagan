const XStreem = require('xstreem');

function deepClone(obj) {
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (err) {
        throw new Error('Not JSON stringable value: ' + obj)
    }
}

function lagan({ initialState = {}, logFile, position = 0 }) {

    const eventstream = new XStreem(logFile);

    const events = {};
    const listeners = {};
    let state = deepClone(initialState);

    function eventHandler(pos, event, meta) {

        if (pos !== position) {
            // Maybe silly to check for this. It just should never happen.
            throw new Error('Major internal error: Events arrives i n wrong order.')
        }

        const responseId = [meta.checksum, meta.host, meta.pid, meta.nonce, meta.time].join('-');

        if (typeof events[event.event] === 'undefined') {
            if (typeof listeners[responseId] !== 'undefined') {
                listeners[responseId](new Error('No projector registered for this kind of event.'));
            }
            position++;
            return;
        }

        try {
            state = deepClone(events[event.event](event, deepClone(state)));
        } catch (err) {
            if (typeof listeners[responseId] !== 'undefined') {
                listeners[responseId](err);
            }
            position++;
            return;
        }

        if (typeof listeners[responseId] !== 'undefined') {
            listeners[responseId](null);
        }

        position++;
    }

    eventstream.listen(position, eventHandler);

    function command(cb) {
        return new Promise((resolve, reject) => resolve())
            .then(() => cb(state))
            .then(event => {
                let resolve, reject;
                const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
                const meta = eventstream.add(event, { returnMeta: true });
                const responseId = [meta.checksum, meta.host, meta.pid, meta.nonce, meta.time].join('-');
                listeners[responseId] = (err) => {
                    delete listeners[responseId];
                    if (err) reject(err);
                    resolve();
                };
                return promise;
            });
    };

    function registerEvent(eventType, projectorFn) {
        if (typeof events[eventType] !== 'undefined') throw new Error('Event type already registered: ' + eventType);
        events[eventType] = projectorFn;
    }

    function stop() {
        eventstream.removeListener(eventHandler);
    }

    return {
        command,
        get logFile() {
            return eventstream.filename;
        },
        get position() {
            return position;
        },
        get state() {
            return deepClone(state);
        },
        registerEvent,
        stop
    };
}

module.exports = lagan;