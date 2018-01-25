# Changelog

## 1.1.0

- :star: **Feature**: `MongooseAutoIncrementID` instances now have the following readonly properties:
  - `isReady` - Whether or not the initialisation has completed 
  - `promise` - The promise returned by applyPlugin()
  - `error` - Error, if any, thrown by applyPlugin()
- :star: **Feature**: `MongooseIncrementID` now has the following static methods:
  - `isReady(schema: Schema, modelName: string): boolean` - Check if the given schema and model have finished their plugin initialisation
  - `getErrorFor(schema: Schema, modelName: string): Error | undefined` - Check if the given schema and model threw an error during initialisation
  - `getPromiseFor(schema: Schema, modelName: string): Promise<void> | undefined` - get the promise returned during initialisation for the given schema and model
- :star: **Feature**: getDefaults() static method added - returns the default options used by the plugin
- :star: **Feature**: setDefaults static method added - override the default options used by the plugin
- :arrows_counterclockwise: **Refactor**: nextCount and resetCount functions are now created during initialisation instead of getting cloned via `.bind(this)`
