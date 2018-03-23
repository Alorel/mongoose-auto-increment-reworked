# Changelog

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [1.2.1 | 2018-03-23](#121--2018-03-23)
- [1.2.0 | 2018-02-11](#120--2018-02-11)
- [1.1.1 | 2018-01-25](#111--2018-01-25)
- [1.1.0 | 2018-01-25](#110--2018-01-25)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## 1.2.1 | 2018-03-23

[Diff](https://github.com/Alorel/mongoose-auto-increment-reworked/compare/1.2.0...v1.2.1)

- **[tests]** Fixed typings for mocha
- **[tests]** Simplified .travis.yml
- **[chore]** Unignored lockfile to allow `npm version`
- **[dependencies]** Set `@types/mongoose` dependency to ^4 | ^5

## 1.2.0 | 2018-02-11 

[Diff](https://github.com/Alorel/mongoose-auto-increment-reworked/compare/1.1.1...1.2.0)

- **[feature]**: Explicit initialisation is now optional. If `initialise()` is not called, the default 'IdCounter' collection will be used.
  - This also means that `applyPlugin()` will no longer throw if initialisation hasn't been performed yet.
- **[feature]**: It's now possible to use the plugin via the schema: `schema.plugin(MongooseAutoIncrementID.plugin, {modelName: 'MyModel'});`
- **[documentation]**: Several typos have been fixed. 

## 1.1.1 | 2018-01-25

[Diff](https://github.com/Alorel/mongoose-auto-increment-reworked/compare/1.1.0...1.1.1)

- **[chore]**: Add diffs to changelog

## 1.1.0 | 2018-01-25

[Diff](https://github.com/Alorel/mongoose-auto-increment-reworked/compare/1.0.0...1.1.0)

- **[feature]**: `MongooseAutoIncrementID` instances now have the following readonly properties:
  - `isReady` - Whether or not the initialisation has completed 
  - `promise` - The promise returned by applyPlugin()
  - `error` - Error, if any, thrown by applyPlugin()
- **[feature]**: `MongooseIncrementID` now has the following static methods:
  - `isReady(schema: Schema, modelName: string): boolean` - Check if the given schema and model have finished their plugin initialisation
  - `getErrorFor(schema: Schema, modelName: string): Error | undefined` - Check if the given schema and model threw an error during initialisation
  - `getPromiseFor(schema: Schema, modelName: string): Promise<void> | undefined` - get the promise returned during initialisation for the given schema and model
- **[feature]**: getDefaults() static method added - returns the default options used by the plugin
- **[feature]**: setDefaults static method added - override the default options used by the plugin
- **[refactor]**: nextCount and resetCount functions are now created during initialisation instead of getting cloned via `.bind(this)`
