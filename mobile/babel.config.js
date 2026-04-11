module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for Reanimated 4 & Worklets
      'react-native-worklets/plugin',
    ],
  };
};
