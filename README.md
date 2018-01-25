[![NPM link](https://nodei.co/npm/mongoose-auto-increment-reworked.svg?compact=true)](https://www.npmjs.com/package/mongoose-auto-increment-reworked)

[![Build Status](https://travis-ci.org/Alorel/mongoose-auto-increment-reworked.svg?branch=master)](https://travis-ci.org/Alorel/mongoose-auto-increment-reworked)
[![Coverage Status](https://coveralls.io/repos/github/Alorel/mongoose-auto-increment-reworked/badge.svg?branch=master)](https://coveralls.io/github/Alorel/mongoose-auto-increment-reworked?branch=master)
[![Greenkeeper badge](https://badges.greenkeeper.io/Alorel/mongoose-auto-increment-reworked.svg)](https://greenkeeper.io/)
![Supports Node >= 6](https://img.shields.io/badge/Node-%3E=6-brightgreen.svg)

A rewrite of [mongoose-auto-increment](https://www.npmjs.com/package/mongoose-auto-increment) with optimisations and
tests updated for the latest versions of Mongoose 4 and 5, as well as new features.

-----

# Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Basic usage](#basic-usage)
- [Getting the next ID](#getting-the-next-id)
- [Resetting the ID to its starting value](#resetting-the-id-to-its-starting-value)
- [Configuration](#configuration)
  - [Default configuration](#default-configuration)
- [Getting initialisation information](#getting-initialisation-information)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Basic usage

The plugin creates a pre-save middleware on the provided schema which generates an auto-incrementing ID, therefore it
must be applied *before* your schema gets turned into a model.

```javascript
import {MongooseAutoIncrementID} from 'mongoose-auto-increment-reworked';
import * as mongoose from 'mongoose';

const MySchema = new mongoose.Schema({
  someField: {
    type: String
  }
});

/*
 * Perform plugin initialisation. This MUST be done once and only once - it initialises the Mongoose model used by the
 * plugin. You can pass a string parameter to the initialiser to give the model a custom name; otherwise, it will default
 * to IdCounter.
 */
MongooseAutoIncrementID.initialise();

const plugin = new MongooseAutoIncrementID(MySchema, 'MyModel');

plugin.applyPlugin()
  .then(() => {
    // Plugin ready to use! You don't need to wait for this promise - any save queries will just get queued.
    // Every document will have an auto-incremented number value on _id.
  })
  .catch(e => {
    // Plugin failed to initialise
  });

// Only turn the schema into the model AFTER applyPlugin has been called. You do not need to wait for the promise to resolve.
const MyModel = mongoose.model('MyModel', MySchema);
```

# Getting the next ID 

```javascript
MyModel._nextCount()
  .then(count => console.log(`The next ID will be ${count}`));
```

# Resetting the ID to its starting value

```javascript
MyModel._resetCount()
  .then(val => console.log(`The counter was reset to ${val}`));
```

# Configuration

The plugin's configuration accepts the following options:

```typescript
/** Plogin configuration */
export interface PluginOptions {
  /**
   * The field that will be automatically incremented. Do not define this in your schema.
   * @default _id
   */
  field: string;
  /**
   * How much every insert should increment the counter by
   * @default 1
   */
  incrementBy: number;
  /**
   * The name of the function for getting the next ID number.
   * Set this to false to prevent the function from being added to the schema's static and instance methods.
   * @default _nextCount
   */
  nextCount: string | false;
  /**
   * The name of the function for resetting the ID number
   * Set this to false to prevent the function from being added to the schema's static and instance methods.
   * @default _resetCount
   */
  resetCount: string | false;
  /**
   * The first number that will be generated
   * @default 1
   */
  startAt: number;
  /**
   * Whether or not to add a unique index on the field. This option is ignored if the field name is _id.
   * @default true
   */
  unique: boolean;
}
```

You can pass them as the third parameter to the plugin's constructor:

```javascript
const options = {
  field: 'user_id', // user_id will have an auto-incrementing value
  incrementBy: 2, // incremented by 2 every time
  nextCount: false, // Not interested in getting the next count - don't add it to the model
  resetCount: 'reset', // The model and each document can now reset the counter via the reset() method
  startAt: 1000, // Start the counter at 1000
  unique: false // Don't add a unique index
};

new MongooseAutoIncrementID(MySchema, 'MyModel', options);
```

## Default configuration

You can get the current default configuration as follows:

```javascript
MongooseAutoIncrementID.getDefaults();
```

And set it as follows:

```javascript
MongooseAutoIncrementID.setDefaults(myNewDefaults);
```

# Getting initialisation information

You can get the current initialisation state of the plugin via instance methods:

```javascript
const mySchema = new mongoose.Schema({/*...*/});
const plugin = new MongooseAutoIncrementID(mySchema, 'MyModel');
const promise = plugin.applyPlugin();

console.log(plugin.promise === promise); // true
console.log(`Plugin ready: ${plugin.isReady}`);
console.log('Initialisation error: ', plugin.error);
```

Or via static methods:

```javascript
MongooseAutoIncrementID.getPromiseFor(mySchema, 'MyModel');
MongooseAutoIncrementID.isReady(mySchema, 'MyModel');
MongooseAutoIncrementID.getErrorFor(mySchema, 'MyModel');
```