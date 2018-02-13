# SWS UI

## Quickstart

`npm install`
and then
`npm start`

A new browser window should automatically open. 
But, if it doesn't then use: 
`http://localhost:3000`

This launches a development environment that instantly 
reloads any changes to the browser for rapid development.

## Production Builds
Use `npm run build` which will bundle the build artifacts using webpack into the `build` directory.


## Directory Structure

`src` : Source and test code
`src/assets` : Images and other assets
`src/components` : Stateless components
`src/containers` : Stateful smart components
`src/routes` : Routes
`src/hoc` : High order Components
`src/pages` : Top level pages 
`stories`: Storybook files
`build`: Production build output
`public`: home of index.html

## For Storybook components
`npm run storybook`
and then
`http://localhost:6006`

## General

This project was bootstrapped with [Create React App](https://github.com/facebookincubator/create-react-app).

## License and Copyright
See the [License File](https://github.com/swift-sunshine/swsui/blob/master/LICENSE)