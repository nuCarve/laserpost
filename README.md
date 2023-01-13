<div align='center' padding-bottom="200px"><img src="https://github.com/nuCarve/laserpost/raw/main/images/nuCarve-logo-color-vert.svg" width="200px" /></div>
&nbsp;  

# [LaserPost](https://nucarve.com/laserpost) 
Autodesk CAM post-processors (Fusion 360, Inventor, HSMWorks) that generate vector files from CAM operations.  Currently supports LightBurn projects (LaserPost for LightBurn) and SVG files (LaserPost for SVG).  All laser configuration is maintained in the CAM and post setup, allowing for LightBurn projects to be created with all settings and SVG files with intelligent grouping and colors and a consistent setup sheet for laser configuration.  Converts CAM operations into vector shapes, including support for ellipses and paths using Bezier curves.  Visit the [LaserPost home page](https://nucarve.com/laserpost) for more information.

## Releases

You are welcome to download the software directly from this repo, but it may be a development or untested version, and will require [building](#building) for the target file format.  For the official downloads with release notes, see [nuCarve LaserPost releases](https://nucarve.com/laserpost/#releases).

## Documentation and tutorials

Video tutorials, documentation and tricks can be found on the [nuCarve LaserPost site](https://nucarve.com/laserpost/#learning).

## Support

Use the [GitHub issue tracker](https://github.com/nuCarve/laserpost/issues) to search known issues or create a new issue.  You may also [send a private message](https://nucarve.com/contact) to the nuCarve team.

## Building

To build LaserPost, you will need [`nodejs`](https://nodejs.org/en/) installed (must be >= node 18.11.0).  No external packages are used, so NPM is not required.

Release configuration is defined in the `release.json` file, including global macros, the list of source files with conditional macros, and the list of target release to create (including macros and filename).  Running the release process will build all targets, placing the resulting file(s) into the `dist` folder.

For example:

```sh
node release/release.mjs
```

This will pull all the various `js` files together into a single file per target, such as `release/dist/laserpost-lbrn.cps` and `release/dist/laserpost-svg.cps`.

Since Fusion 360 needs the post located in a system specific directory in order for Fusion to detect the source change, you can also specify a path to the directory to store a duplicate of the generated file using the `-d <path>` option, such as on Windows a path might be similar to:

```sh
node release/release.mjs -d="C:\Users\myname\AppData\Local\Autodesk\Autodesk Fusion 360\32TABC6DD2N8Q\W.login\M\D23203423432806\CAMPosts"
```

## Testing

Automated system testing using the Autodesk CAM post processor is available.  See the [README.md](tests/README.md) file located in the `tests` folder.

## License

See the [LICENSE](LICENSE) file.
