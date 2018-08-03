const expect = require('chai').expect;
const Lagan = require('../index');

describe('lagan()', () => {

    it('should return an object with functions and state', () => {
        const l = new Lagan({});
        after(() => l.stop());

        expect(l).to.be.an('object');
        expect(l.initialState).to.be.an('object');
        expect(l.logFile).to.be.a('string');
        expect(l.registerEvent).to.be.a('function');
        expect(l.state).to.be.an('object');
        expect(l.stop).to.be.a('function');
    });

    it('should start with a state which is a clone of the initialState', () => {
        const initialState = { monkeys: 5, doneys: 3, bonkeys: [ 5, 6, { whut: 'yes', what: [ 4, 3, 2 ] } ] };

        const l = new Lagan({ initialState });
        after(() => l.stop());

        expect(l.state).to.deep.equal(initialState);
    });

    it('should expose he initial state', () => {
        const initialState = { monkeys: 5, donkeys: 3, bonkeys: [ 5, 6, { whut: 'yes', what: [ 4, 3, 2 ] } ] };

        const l = new Lagan({ initialState });
        after(() => l.stop());

        expect(l.initialState).to.deep.equal(initialState);
    });

    it('should have an empty object as initial state, if not specified', () => {
        const l = new Lagan({});
        after(() => l.stop());

        expect(l.state).to.be.an('object');
        expect(l.state).to.deep.equal({});
    });

    describe('event storage', () => {
        it('can be simultaneously read by multiple lagan instances', function() {

            this.timeout(10000);

            // Using same storage file:
            const initialState = { users: [] };
            const l0 = new Lagan({ initialState });
            const l1 = new Lagan({ initialState, logFile: l0.logFile });
            const l2 = new Lagan({ initialState, logFile: l0.logFile });
            after(() => {
                l0.stop();
                l1.stop();
                l2.stop();
            });

            let resolve0, resolve1, resolve2;
            const promise0 = new Promise((resolve, reject) => { resolve0 = resolve; });
            const promise1 = new Promise((resolve, reject) => { resolve1 = resolve; });
            const promise2 = new Promise((resolve, reject) => { resolve2 = resolve; });

            class UserAdded0 extends l0.Event {
                get type() { return 'UserAdded' }; // Override the class name (since it will differ for the different Lagan instances.)
                project(state) {
                    if (this.props.name === 'John Moe') resolve0();
                    return { ...state, users: [ ...state.users, { name: this.props.name } ] };
                }
            }
            class UserAdded1 extends l1.Event {
                get type() { return 'UserAdded' }; // Override the class name (since it will differ for the different Lagan instances.)
                project(state) {
                    if (this.props.name === 'John Moe') resolve1();
                    return { ...state, users: [ ...state.users, { name: this.props.name } ] };
                }
            }
            class UserAdded2 extends l2.Event {
                get type() { return 'UserAdded' }; // Override the class name (since it will differ for the different Lagan instances.)
                project(state) {
                    if (this.props.name === 'John Moe') resolve2();
                    return { ...state, users: [ ...state.users, { name: this.props.name } ] };
                }
            }

            l0.registerEvent(UserAdded0);
            l1.registerEvent(UserAdded1);
            l2.registerEvent(UserAdded2);

            function addUser0(name) {
                const event = new UserAdded0({ name });
                return event.apply();
            }

            return Promise.all([
                addUser0('John Doe'),
                addUser0('John Norum'),
                addUser0('John Moe'),
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

    describe('validation', () => {

        it('should run twice on a successful command, first without position number, and then with one', () => {
            const initialState = { users: [] };
            const l = new Lagan({ initialState });
            after(() => l.stop());

            const calls = [];

            class UserAdded extends l.Event {
                validate(state, position) {
                    calls.push(position);
                }
                project(state) {
                    return { ...state, users: [ ...state.users, { name: this.props.name, email: this.props.email } ] };
                }
            }

            l.registerEvent(UserAdded);

            function addUser(name, email) {
                return new UserAdded({ name, email }).apply();
            }


            return addUser('John Doe', 'john@example.org')
                .then(() => {
                    expect(calls).to.deep.equal([ null, 0 ]);
                });
        });

        it('should handle async validator functions', function() {

            this.timeout(30000);

            const initialState = { positions: [], sentence: '' };
            const l = new Lagan({ initialState });
            after(() => l.stop());

            class SyncValidatorSyncProjector extends l.Event {
                validate(state, position) {
                    if (position === null && this.props.failFirst === true) throw new Error('First validation failed.');
                    if (position !== null && this.props.failSecond === true) throw new Error('Second validation failed.');
                }
                project(state) {
                    return { positions: [...state.positions, this.position], sentence: state.sentence + this.props.letter }
                }
            }

            class SyncValidatorAsyncProjector extends l.Event {
                validate(state, position) {
                    if (position === null && this.props.failFirst === true) throw new Error('First validation failed.');
                    if (position !== null && this.props.failSecond === true) throw new Error('Second validation failed.');
                }
                project(state) {
                    return new Promise((resolve, reject) => setTimeout(resolve, Math.floor(Math.round() * 30)))
                        .then(() => {
                            return { positions: [...state.positions, this.position], sentence: state.sentence + this.props.letter }
                        })
                }
            }

            class AsyncValidatorSyncProjector extends l.Event {
                validate(state, position) {
                    return new Promise((resolve, reject) => {
                        setTimeout(resolve, Math.floor(Math.round() * 30));
                    })
                        .then(() => {
                            if (position === null && this.props.failFirst === true) throw new Error('First validation failed.');
                            if (position !== null && this.props.failSecond === true) throw new Error('Second validation failed.');
                        });
                }
                project(state) {
                    return { positions: [...state.positions, this.position], sentence: state.sentence + this.props.letter }
                }
            }

            class AsyncValidatorAsyncProjector extends l.Event {
                validate(state, position) {
                    return new Promise((resolve, reject) => {
                        setTimeout(resolve, Math.floor(Math.round() * 30));
                    })
                        .then(() => {
                            if (position === null && this.props.failFirst === true) throw new Error('First validation failed.');
                            if (position !== null && this.props.failSecond === true) throw new Error('Second validation failed.');
                        });
                }
                project(state) {
                    return new Promise((resolve, reject) => setTimeout(resolve, Math.floor(Math.round() * 30)))
                        .then(() => {
                            return { positions: [...state.positions, this.position], sentence: state.sentence + this.props.letter }
                        })
                }
            }

            l.registerEvent(SyncValidatorSyncProjector);
            l.registerEvent(SyncValidatorAsyncProjector);
            l.registerEvent(AsyncValidatorSyncProjector);
            l.registerEvent(AsyncValidatorAsyncProjector);

            function addLetterSyncSync(letter, failFirst, failSecond) {
                return new SyncValidatorSyncProjector({ letter, failFirst, failSecond }).apply();
            }

            function addLetterSyncAsync(letter, failFirst, failSecond) {
                return new SyncValidatorAsyncProjector({ letter, failFirst, failSecond }).apply();
            }

            function addLetterAsyncSync(letter, failFirst, failSecond) {
                return new AsyncValidatorSyncProjector({ letter, failFirst, failSecond }).apply();
            }

            function addLetterAsyncAsync(letter, failFirst, failSecond) {
                return new AsyncValidatorAsyncProjector({ letter, failFirst, failSecond }).apply();
            }

            const sentence = 'When seagulls follow the trawler it is because they think sardines will be thrown into the sea.';
        
            const promise = sentence.split('').reduce((acc, char, index) => {
                let action;
                switch (index % 4) {
                    case 0:
                        action = addLetterSyncSync;
                        break;
                    case 1:
                        action = addLetterSyncAsync;
                        break;
                    case 2:
                        action = addLetterAsyncSync;
                        break;
                    case 3:
                        action = addLetterAsyncAsync;
                        break;
                }
                return acc.then(() => {
                    return action(char, false, false);
                })
                    .then(() => {
                        return action(char, true, false)
                            .catch(err => {
                                return err;
                            })
                            .then(err => {
                                expect(err.message).to.equal('First validation failed.');
                            });
                    })
                    .then(() => {
                        return action(char, false, true)
                            .catch(err => {
                                return err;
                            })
                            .then(err => {
                                expect(err.message).to.equal('Second validation failed.');
                            });
                    });
            }, new Promise((resolve, reject) => resolve()));

            return promise
                .then(err => {
                    l.state.positions.forEach(pos => {
                        // We do three actions for each letter.
                        // One will be successful.
                        // One will fail in the first validation and hence never get a position number.
                        // One will fail in the second validation and hence get a position number.
                        // So, every second event actually adds something to the sentence:
                        expect(pos % 2).to.equal(0);
                    })
                    expect(l.state.sentence).to.equal(sentence);
                })

        });

    });

    describe('command', () => {

        it('should return a Promise which resolves after event has projected on state', () => {
            const initialState = { users: [] };
            const l = new Lagan({ initialState });
            after(() => l.stop());

            class UserAdded extends l.Event {
                validate() {
                }
                project(state) {
                    return { ...state, users: [ ...state.users, { name: this.props.name, email: this.props.email } ] };
                }
            }

            l.registerEvent(UserAdded);

            function addUser(name, email) {
                return new UserAdded({ name, email }).apply();
            }


            return addUser('John Doe', 'john@example.org')
                .then(() => {
                    expect(l.state).to.deep.equal({
                        users: [ { name: 'John Doe', email: 'john@example.org' } ]
                    });
                });
        });

        it('should handle async projections properly, waiting for promises to resolve/reject until next event is handled', function() {
            this.timeout(20000);

            const initialState = { sentence: '' };
            const l = new Lagan({ initialState });
            after(() => l.stop());

            class LetterAdded extends l.Event {
                validate() {
                }
                project(state) {
                    return new Promise((resolve, reject) => {
                        setTimeout(resolve, Math.floor(Math.random() * 100));
                    })
                        .then(() => {
                            return { sentence: state.sentence + this.props.letter };
                        });
                }
            }
            l.registerEvent(LetterAdded);

            function addLetter(letter) {
                return new LetterAdded({ letter }).apply();
            }

            const sentence = 'When seagulls follow the trawler it is because they think sardines will be thrown into the sea.';
        
            const promises = sentence.split('').reduce((acc, char) => { acc.push(addLetter(char)); return acc; }, []);
            return Promise.all(promises)
                .then(() => {
                    expect(l.state.sentence).to.equal(sentence);
                })
        });

        it('should return a Promise which rejects if there is a throw in the projection function', () => {
            const initialState = { users: [ { name: 'John Norum', email: 'john@example.org' } ] };
            const l = new Lagan({ initialState });
            after(() => l.stop());


            class UserAdded extends l.Event {
                validate(state) {
                }
                project(state) {
                    throw new Error('Some projection error.');
                }
            }

            l.registerEvent(UserAdded);

            function addUser(name, email) {
                return new UserAdded({ name, email }).apply();
            }

            return addUser('John Doe', 'john@example.org')
                .catch(err => err)
                .then(err => {
                    expect(err.message).to.equal('Some projection error.');
                });
        });

    });

});