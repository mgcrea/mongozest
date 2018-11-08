
declare namespace mongozest {
  class Hooks {
    connect(dbName: string): Promise<MongoDb>
    loadModel(Model: ModelConstructor): Promise<Model>
    loadModels(Models: {[s: string]: ModelConstructor}): Promise<{[s: string]: Model}>
  }
}

export = mongozest;