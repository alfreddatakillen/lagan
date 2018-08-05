Lagan
=====

Event sourcing and CQRS module for Node.js.


Usage
-----   

```
// const database = your-database-layer;

const Lagan = require('lagan');
const lagan = new Lagan({
    logFile: './my-data-storage.log'  // Path to persistent data storage file
});


// Event class:

class UserSignedUp extends lagan.Event {

    validate() {
        if (typeof this.props.name !== 'string') throw new Error('Invalid name.');

        email = this.props.email.toLowerCase().trim();
        if (!this.props.email.match(/^[^@]+@[^@]$/)) throw new Error('Invalid email.');

        if (database.userExists(this.props.email))
            throw new Error('Subscriber already in database.');
    }

    project() {
        database.addToUserTable(this.props.name, this.props.email);
    }
}

lagan.registerEvent(UserSignedUp);


// Command function:

function signUpUser(name, email) {
    return new UserSignedUp({ name, email }).apply();
}


// Now, we can use the command:

signupUser('John Doe', 'john@example.org')
    .then(() => {
        // Event successfully added to event stream, and projected to database.
    })
    .catch(err => {
        // Event was not created, or there was an error in validation/projection
        // after the event was created.
    });
```


Using Lagan's state object
--------------------------

Your `.validate()` and `.project()` functions can use any state handler you like.

If you want to just keep the application state in a Javascript object in memory, you can use Lagan's state object.

Just instantiate Lagan with an `initialState` (which should be the state object before the first event has been projected):

```
const lagan = new Lagan({
    initialState: { users: [] }
});
```

Your `.validate()` and `.project()` functions will get a state object in the arguments object.
What you return from the `.project()` function will be the new state after projection:

```
class UserSignedUp extends lagan.Event {

    validate({ state }) {
        if (state.users.filter(user => user.email === this.props.email).length > 0)
            throw new Error('Subscriber already in database.');
    }

    project({ state }) {
        return { ...state, users: { ...state.users, { name: this.props.name, email: this.props.email } } };
    }

}
```

It is good practice to use immutable coding pattern using spread operators in the projector.



Validation
----------

Validation is the process of checking that the event is properly formatted and
valid before it is added to the event stream.

### Synchronous or asynchronous

Validation can be synchronous or asynchronous. If it is asynchronous, the `validate()`
function must return a Promise.



Pre-validation and post-validation
----------------------------------

Your `validate()` function will run twice when adding a new event to the event stream.

### Pre-validation

First, when you create a new event, `validate()` will run with whatever state
Lagan has at the moment. This is called "pre-validation".
If the pre-validation does not throw an exception or returns a rejected promise,
the event will be added to the event stream.

### Post-validation

Then, after the event has been stored to the stream, and it is time to for projection,
`validate()` will run again. This is called "post-validation". 
If the post-validation does not throw an exception or returns a rejected promise,
the event will be projected to the state.

### Distinguish pre-validation from post-validation

The `validate()` function will be called with two aruments: `state` and `position`.

During pre-validation, `state` is just the latest state that Lagan currently knows of,
and `position` is null, since the event has not been written to the event stream yet,
so it does not have a position so far.

During post-validation, `state` is the state when all event before this event has been
projected, and `position` is the position number of this event in the event stream.

A good way to distinguish pre-validation from post-validation is to check if `position`
is `null`.

```
class UserSignedUp extends lagan.Event {

    validate({ position }) {
        if (position === null) {
            // Pre-validation
        } else {
            // Post-validation
        }
        
        ...

    }

    ....
```


Event ordering
--------------

Lagan guarantees that the event projection will be in the same order as you do `.apply()` on
your event objects, as long as your validate function is synchronous during pre-validation.



Curiosities
-----------

This module got it's name from the river Lagan, which flows through Swedish hicksvilles like
Vaggeryd, Ljungby and Alla Har En Ko I Värnamo.
