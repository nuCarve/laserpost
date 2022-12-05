<div align='center' padding-bottom="200px"><img src="https://github.com/nuCarve/laserpost/raw/main/images/nuCarve-logo-color-vert.svg" width="200px" /></div>
&nbsp;  

# [LaserPost](https://nucarve.com/laserpost)
A Fusion 360 CAM post-processor that directly generates LightBurn (LBRN) projects.  All LightBurn configuration is 
maintained in the CAM and post setup, allowing for LightBurn projects to be created with all settings.  Converts CAM 
operations into LightBurn shapes, including support for Ellipse and Path using Bezier curves.  Visit the 
[LaserPost home page](https://nucarve.com/laserpost) for more information.

## Releases

You are welcome to download the software directly from this repo, but it may be a development or untested version.  For the official downloads with
release notes, see [nuCarve LaserPost releases](https://nucarve.com/laserpost/#releases).

## Documentation and tutorials

Video tutorials, documentation and tricks can be found on the [nuCarve LaserPost site](https://nucarve.com/laserpost/#learning).

## Other autodesk CAM products

In theory this CAM will work with other Autodesk products (such as HSM).  If you try it, we would appreciate knowing if it works or not!  
Submit an [issue](https://github.com/nuCarve/laserpost/issues/new) or send us a [message](https://nucarve.com/about#contact) to let us know.

## Support

Use the [GitHub issue tracker](https://github.com/nuCarve/laserpost/issues) to search known issues or create a new issue.  You may also 
[send a private message](https://nucarve.com/about#contact) to the nuCarve team.

## Building

To build LaserPost, you will need [`nodejs`](https://nodejs.org/en/) installed.  No external packages are used, so NPM is not required.

From the root directory in the project, issue the command:

```sh
node release/release.mjs
```

This will pull all the various `js` files together into a single `release/dist/laserpost.cps` file, as well as apply the version number that is defined in the `version.json` file.  

Since Fusion 360 needs the post located in a specific directory, you can also specify a path to a file to store a duplicate of the generated file, such as:

```sh
node release/release.mjs "C:\Users\myname\AppData\Local\Autodesk\Autodesk Fusion 360\32TABC6DD2N8Q\W.login\M\D23203423432806\CAMPosts\laserpost.cps"
```

## License

See the [LICENSE](LICENSE) file.
