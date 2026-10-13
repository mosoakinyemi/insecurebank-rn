module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [['transform-inline-environment-variables', { include: ['LAB_API_BASE_URL', 'LAB_DEMO_SECRET'] }]],
};
