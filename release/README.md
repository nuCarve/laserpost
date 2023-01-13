<div align='center' padding-bottom="200px"><img src="https://github.com/nuCarve/laserpost/raw/main/images/nuCarve-logo-color-vert.svg" width="200px" /></div>
&nbsp;  

# [LaserPost](https://nucarve.com/laserpost) Release Manager

You are welcome to download the software directly from this repo, but it may be a development or untested version, and will require [building](#building) for the target file format.  For the official downloads with release notes, see [nuCarve LaserPost releases](https://nucarve.com/laserpost/#releases).

## Building

To build LaserPost, you will need [`nodejs and npm`](https://nodejs.org/en/) installed (must be >= node
18.11.0).  Prior to running the build, you must run `npm i` from the `release` directory:

```sh
cd release
npm i
cd ..
```

Release configuration is defined in the `release.json` file, including global macros, the list of source files with conditional macros, and the list of target release to create (including macros and filename).  Running the release process will build all targets, placing the resulting file(s) into the `dist` folder.

For example:

```sh
npm start
```

or if you prefer, since "start" is perhaps confusing:

```sh
npm run build
```

This will pull all the various `js` files together into a single file per target, such as `release/dist/laserpost-lbrn.cps` and `release/dist/laserpost-svg.cps`.

Since Fusion 360 needs the post located in a system specific directory in order for Fusion to detect the source change, you can also specify a path to the directory to store a duplicate of the generated file using the `-d <path>` option, such as on Windows a path might be similar to:

```sh
npm start -- -d="C:\Users\myname\AppData\Local\Autodesk\Autodesk Fusion 360\32TABC6DD2N8Q\W.login\M\D23203423432806\CAMPosts"
```

You can also set the environment variable `AUTODESK_CAMPOSTS` to the desired duplicate path, and that will be used as the default (and can be overridden with `-d`).

## Testing

Automated system testing using the Autodesk CAM post processor is available.  See the [README.md](tests/README.md) file located in the `tests` folder.

## License

See the [LICENSE](LICENSE) file.
