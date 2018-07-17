Lagan
=====

Simple module for CQRS and event sourced state handling in Node.js.

Usage
-----   

```
const laganOptions = {
    initialState: { users: [] },
    logFile: './my-data-storage.log'  // Path to persistent data storage file
}
const lagan = require('lagan')(laganOptions);

// Command function:

function signupUser(name, email) {

    // Some validation:

    if (typeof name !== 'string') throw new Error('Invalid name.');

    email = email.toLowerCase().trim();
    if (!email.match(/^[^@]+@[^@]$/)) throw new Error('Invalid email.');

    if (lagan.state.users.filter(user => user.email === email).lenght > 0)
        throw new Error('Subscriber already in database.');

    // Then create the event:

    return lagan.event(
        'userSignedUp',
        {
            name,
            email
        }
    );
}

// Projection function

lagan.registerEvent('userSignedUp', (props, state) => {
    
    // Some validation:
    if (state.users.filter(user => user.email === props.email).length > 0)
        throw new Error('Subscriber already in database.');

    return { ...state, users: { ...state.users, { name: props.name } } };
});


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


