const expect = require('chai').expect;
const lagan = require('../index');

describe('lagan()', () => {

    it('should return an object with functions and state', () => {
        const l = lagan({});
        after(() => l.stop());

        expect(l).to.be.an('object');
        expect(l.event).to.be.a('function');
        expect(l.registerEvent).to.be.a('function');
        expect(l.stop).to.be.a('function');
        expect(l.logFile).to.be.a('string');
        expect(l.state).to.be.an('object');
    });

    it('should start with a state which is a clone of the initialState', () => {
        const initialState = { monkeys: 5, doneys: 3, bonkeys: [ 5, 6, { whut: 'yes', what: [ 4, 3, 2 ] } ] };

        const l = lagan({ initialState });
        after(() => l.stop());

        expect(l.state).to.deep.equal(initialState);
    });

    it('should have an empty object as initial state, if not specified', () => {
        const l = lagan({});
        after(() => l.stop());

        expect(l.state).to.be.an('object');
        expect(l.state).to.deep.equal({});
    });

    describe('event storage', () => {
        it('can be simultaneously read by multiple lagan instances', () => {

            // Using same storage file:
            const l0 = lagan({ initialState: { users: [] }});
            const l1 = lagan({ initialState: { users: [] }, logFile: l0.logFile });
            const l2 = lagan({ initialState: { users: [] }, logFile: l0.logFile });
            after(() => {
                l0.stop();
                l1.stop();
                l2.stop();
            });

            let resolve0, resolve1, resolve2;
            const promise0 = new Promise((resolve, reject) => { resolve0 = resolve; });
            const promise1 = new Promise((resolve, reject) => { resolve1 = resolve; });
            const promise2 = new Promise((resolve, reject) => { resolve2 = resolve; });

            l0.registerEvent('userAdded', (props, state) => {
                if (props.name === 'John Doe') {
                    resolve0();
                }
                return { ...state, users: [ ...state.users, { name: props.name } ] };
            });
            l1.registerEvent('userAdded', (props, state) => {
                if (props.name === 'John Norum') {
                    resolve1();
                }
                return { ...state, users: [ ...state.users, { name: props.name } ] };
            });
            l2.registerEvent('userAdded', (props, state) => {
                if (props.name === 'John Moe') {
                    resolve2();
                }
                return { ...state, users: [ ...state.users, { name: props.name } ] };
            });

            function addUser(props) {
                return l0.event(
                    'userAdded',
                    {
                        name: props.name
                    }
                )
            }

            return Promise.all([
                addUser({ name: 'John Doe' }).apply(),
                addUser({ name: 'John Norum' }).apply(),
                addUser({ name: 'John Moe' }).apply(),
                promise0,
                promise1,
                promise2
            ])
                .then(() => {
                    expect(l0.state).to.deep.equal({ users: [ { name: 'John Doe' }, { name: 'John Norum' }, { name: 'John Moe' } ] });
                    expect(l1.state).to.deep.equal(l0.state);
                    expect(l2.state).to.deep.equal(l0.state);
                });

        });
    });

    describe('command', () => {

        it('should return a Promise which resolves after event has projected on state', () => {
            const initialState = { users: [] };
            const l = lagan({ initialState });
            after(() => l.stop());
            function addUser(props) {
                return l.event(
                    'userAdded',
                    {
                        name: props.name,
                        email: props.email
                    }
                );
            }
            l.registerEvent('userAdded', (props, state) => {
                return { ...state, users: [ ...state.users, { name: props.name, email: props.email } ] };
            });
            return addUser({ name: 'John Doe', email: 'john@example.org' }).apply()
                .then(() => {
                    expect(l.state).to.deep.equal({
                        users: [ { name: 'John Doe', email: 'john@example.org' } ]
                    });
                });
        });

        it('should return a Promise which rejects if there is a throw in the projection function', () => {
            const initialState = { users: [ { name: 'John Norum', email: 'john@example.org' } ] };
            const l = lagan({ initialState });
            after(() => l.stop());
            function addUser(props) {
                return l.event(
                    'userAdded',
                    {
                        event: 'userAdded',
                        name: props.name,
                        email: props.email
                    }
                );
            }
            l.registerEvent('userAdded', (props, state) => {
                if (state.users.filter(user => user.email === props.email).length > 0) {
                    throw new Error('Duplicate email address.');
                }
                return { ...state, users: [ ...state.users, { name: props.name, email: props.email } ] };
            });
            return addUser({ name: 'John Doe', email: 'john@example.org' }).apply()
                .catch(err => err)
                .then(err => {
                    expect(err.message).to.equal('Duplicate email address.');
                });
        });

    });

});