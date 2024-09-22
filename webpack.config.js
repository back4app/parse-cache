'use strict';

module.exports = {
    watchOptions: {
        ignored: /node_modules/
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader'
                }
            }
        ]
    },
    output: {
        library: 'parseCache',
        libraryTarget: 'umd',
        filename: 'parse-cache.js'
    },
    resolve: {
        fallback: {
            util: false
        }
    }
};
