Lagan
=====

Simple module for CQRS and event sourced state handling in Node.js.


Usage
-----   

```
const Lagan = require('lagan');
const lagan = new Lagan({
    initialState: { users: [] },
    logFile: './my-data-storage.log'  // Path to persistent data storage file
});

// Event class:

class UserSignedUp extends lagan.Event {

    validate(state) {
        if (typeof this.props.name !== 'string') throw new Error('Invalid name.');

        email = this.props.email.toLowerCase().trim();
        if (!this.props.email.match(/^[^@]+@[^@]$/)) throw new Error('Invalid email.');

        if (state.users.filter(user => user.email === this.props.email).length > 0)
            throw new Error('Subscriber already in database.');
    }

    project(state) {
        return { ...state, users: { ...state.users, { name: this.props.name } } };
    }
}

lagan.registerEvent(UserSignedUp);


// Command function:

function signUpUser(user, email) {
    return new UserSignedUp({ user, email }).apply();
}


// Now, we can use the command:

signupUser('John Doe', 'john@example.org').apply()
    .then(() => {
        console.log(lagan.state);
    })
    .catch(err => {
        // Event was not created, or there was an error in validation/projection
        // after the event was created.
    });
```


Validation
----------

Validation is the process of checking that the event is properly formatted and
valid before the event is added to the event stream.

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

    validate(state, position) {
        if (position === null) {
            // Pre-validation
        } else {
            // Post-validation
        }
        
        ...

    }

    ....
```



Strong ordering guarantee
-------------------------

Lagan guarantees that the event projection will be in the same order as you do `.apply()` on
your event object, as long as your validate function is synchronous during pre-validation.





Curiosities
-----------

This module got it's name from the river Lagan, which flows through Swedish hicksvilles like
Vaggeryd, Ljungby and Alla Har En Ko I Värnamo.


