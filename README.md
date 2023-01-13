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

If you wish to modify the source, or do your own local build, you must run a release process.  See the [README.md](release/README.md) file located in the `release` folder for information.

## Testing

Automated system testing using the Autodesk CAM post processor is available.  See the [README.md](tests/README.md) file located in the `tests` folder for information.

## License

See the [LICENSE](LICENSE) file.
