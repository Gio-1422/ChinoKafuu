const Logger = require('../../structures/util/Logger')
const { Worker } = require('worker_threads')
const path = require('path')
const os = require('os-utils')

module.exports = class Manager {
  constructor() {
    this.clusterAmount = parseInt(process.env.CLUSTER_AMOUNT) || require('os').cpus().length || 6
    this.shardsPerCluster = Math.round(parseInt(process.env.SHARD_AMOUNT) / this.clusterAmount)
    this.clusters = []
    if (process.env.PRODUCTION !== 'true') {
      Logger.info('The bot is running in development mode. Your console will get messy.')

      setInterval(() => {
        os.cpuUsage(function (u) {
          Logger.info(`Resource usage:\n Memory ${Math.round(os.freemem())}MB/${Math.round(os.totalmem()) / 1000}GB (${Math.round(os.freememPercentage())}% usage)\n CPU: ${u}% usage ${Math.round(os.loadavg(1))}% load avg/1m.`)
        })
      }, 60 * 1000)
    }
  }

  start() {
    Logger.info(`Spawning ${this.clusterAmount} clusters, each one with ${this.shardsPerCluster} ${this.shardsPerCluster === 1 ? 'shard' : 'shards'}.`)
    this.spawnClusters()
  }

  createCluster(id, env) {
    const worker = new Worker(path.resolve(__dirname + '/../', 'cluster.js'), {
      env: env ? { ...process.env, ...env } : {
        ...process.env,
        CLUSTER_ID: id,
        SHARDS_PER_CLUSTER: this.shardsPerCluster
      }
    })
    worker.on('exit', () => this.onExit(id))
    worker.on('error', (err) => this.onError(id, err))
    return worker
  }

  spawnClusters() {
    this.clusters = new Array(this.clusterAmount).fill(0).map((_, i) => this.createCluster(i))
  }

  onExit(worker) {
    Logger.error(`Mayday! Cluster ${worker} died! Starting another cluster now.`)
    this.clusters[worker] = this.createCluster(worker)
  }

  onError(id, error) {
    Logger.error(`Cluster ${id} returned an error: ${error.stack}`)
  }
}