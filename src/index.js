import path from 'path'
import fs from 'fs'

import _ from 'lodash'

import getModuleDependencies from './lib/getModuleDependencies'
import registerConfigAsDependency from './lib/registerConfigAsDependency'
import processTailwindFeatures from './processTailwindFeatures'
import formatCSS from './lib/formatCSS'
import resolveConfig from './util/resolveConfig'
import getAllConfigs from './util/getAllConfigs'
import { supportedConfigFiles } from './constants'
import defaultConfig from '../stubs/defaultConfig.stub.js'

// 处理项目配置文件, 如: tailwind.config.js，最终的结果是得到一条路径
// 下面的例子是在postcss插件配置里使用
/*
* postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: { config: './custom-config.js' },
  },
}
*/
function resolveConfigPath(filePath) {
  // require('tailwindcss')({ theme: ..., variants: ... })
  if (_.isObject(filePath) && !_.has(filePath, 'config') && !_.isEmpty(filePath)) {
    return undefined
  }

  // require('tailwindcss')({ config: 'custom-config.js' })
  if (_.isObject(filePath) && _.has(filePath, 'config') && _.isString(filePath.config)) {
    return path.resolve(filePath.config)
  }

  // require('tailwindcss')({ config: { theme: ..., variants: ... } })
  if (_.isObject(filePath) && _.has(filePath, 'config') && _.isObject(filePath.config)) {
    return undefined
  }

  // require('tailwindcss')('custom-config.js')
  if (_.isString(filePath)) {
    return path.resolve(filePath)
  }

  // require('tailwindcss')
  for (const configFile of supportedConfigFiles) {
    try {
      const configPath = path.resolve(configFile)
      fs.accessSync(configPath)
      return configPath
    } catch (err) {}
  }

  return undefined
}

const getConfigFunction = (config) => () => {
  if (_.isUndefined(config)) {
    return resolveConfig([...getAllConfigs(defaultConfig)])
  }

  // Skip this if Jest is running: https://github.com/facebook/jest/pull/9841#issuecomment-621417584
  if (process.env.JEST_WORKER_ID === undefined) {
    if (!_.isObject(config)) {
      getModuleDependencies(config).forEach((mdl) => {
        delete require.cache[require.resolve(mdl.file)]
      })
    }
  }

  const configObject = _.isObject(config) ? _.get(config, 'config', config) : require(config)

  return resolveConfig([...getAllConfigs(configObject)])
}

// PostCSS 插件入口
module.exports = function (config) {
  const plugins = []
  // 
  const resolvedConfigPath = resolveConfigPath(config)

  if (!_.isUndefined(resolvedConfigPath)) {
    plugins.push(registerConfigAsDependency(resolvedConfigPath))
  }

  return {
    postcssPlugin: 'tailwindcss',
    plugins: [
      ...plugins,
      processTailwindFeatures(getConfigFunction(resolvedConfigPath || config)),
      formatCSS,
    ],
  }
}

module.exports.postcss = true