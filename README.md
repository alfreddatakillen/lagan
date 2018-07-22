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

    validate() {
        if (typeof this.props.name !== 'string') throw new Error('Invalid name.');

        email = this.props.email.toLowerCase().trim();
        if (!this.props.email.match(/^[^@]+@[^@]$/)) throw new Error('Invalid email.');

        if (lagan.state.users.filter(user => user.email === this.props.email).length > 0)
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

Curiosities
-----------

This module got it's name from the river Lagan, which flows through Swedish hicksvilles like
Vaggeryd, Ljungby and Alla Har En Ko I Värnamo.


