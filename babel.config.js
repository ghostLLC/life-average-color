module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['inline-dotenv', { systemVar: 'overwrite' }],
  ],
};
