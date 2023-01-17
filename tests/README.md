<div align='center' padding-bottom="200px"><img src="https://github.com/nuCarve/laserpost/raw/main/images/nuCarve-logo-color-vert.svg" width="200px" /></div>
&nbsp;  

# [LaserPost](https://nucarve.com/laserpost) Automated Testing

Automated testing will execute the Autodesk `post` executable against a collection of
premade intermediate `cnc` files, using the various LaserPost CPS post-processors with various
property configuration values.  The tests use a combination of expressions to test the resulting
generated files for matching (or forbidden) values (causing failures when incorrect), as well as
create snapshots of the content (the entire file, or fragments to limit the scope of the test) which
are then compared for differences from a baseline snapshot (and differences cause a failure).
Information on the various files and models used, see the [README.md](cnc/README.md) file in the `tests/cnc`
folder.

# Install and test execution

To build LaserPost, you will need [`nodejs and npm`](https://nodejs.org/en/) installed (must be >= node
18.11.0).  Prior to running the build, you must run `npm i` from the root directory (which will set
up both release and test):

```sh
npm i
```

Then to execute the tests, from the root of the project, use:

```sh
npm test
```

This will attempt to run the Autodesk post-processor (`post.exe` or `post`, depending on your
operating system).  If this cannot be found in your path, the tests will fail with errors.  You can
set the environment variable `AUTODESK_POST` to the location of the post, add it to your path, or
specify a specific path using the `-pp` option:

```sh
npm test -- -pp="C:\Users\myname\AppData\Local\Autodesk\webdeploy\production\212ef2a73b4faa7986fe0d205fb521fc68f5f11b\Applications\CAM360\post"
```

Use the option `-?` to see help for the currently available set of options.  Make sure to use the
`npm` switch option when passing arguments that start with a `-` character by preceeding them with
`--`.  For example, to run tests using the default post processor (either in your path, or from the
`AUTODESK_POST` environment variable), but only for tests that contain the name "alignment" and only
for the LightBurn post-processor:

```sh
npm test alignment -- -p=burn
```

## CNC intermediate files

Models used for testing are defined using Autodesk CAM "intermediate" CNC files.  These start with a
solid model and CAM manufacturing setups and operations, and then are generated using the "Export
CNC file to Visual Studio Code" (`export cnc file to vs code.cps`) post-processor (available on the
[Autodesk CAM Post Library](https://cam.autodesk.com/hsmposts)).  

The most consistent way to set up CNC files for testing is to always ensure that all properties
remain at their default (unchanged) values.  First ensure the machine has the default values, by
editing the machine, switching to the post-properties tab, clicking on the three dots next to "Post
properties" and selecting "Restore all defaults".  Operation defaults are manual - you need to
ensure each operation has no custom settings.  Then when running the post, click the three dots in
the upper-right corner and select "Restore to all machine defaults".

To run the post, use the post-dropdown to switch to the "Export CNC file to Visual Studio Code"
post, and run the post.  Open the resulting `.nc` file, and inside that file is the path to the
 folder that contains the required `.cnc` file.  Locate and copy that file into the `tests/cnc`
 folder and configure the `tests.json` file for whatever tests you wish to run using the model.

## Test configuration

See the `tests.json` file located in the `tests` folder for all test configuration.  An inheritance
model is used to simplify the file construction.  The `setups` object defines all available setups,
which control options delivered to the Autodesk Post executable.  Individual setups can reference
other setups by name, which will inherit all values and then allow individual values to be
overridden.

Tests themselves can also define (override) the same setup parameters.  In addition, they must
contain a `name` property which defines the name of the test.

The `posts` property identify which posts are to be tested.  This is an array so multiple posts can
be executed against the same test.  If this property is overridden by a test or setup, all values
are replaced (meaning, you can't add a single new post as it would replace any prior ones).  

This concept of inheritance (overriding values) is consistent throughout, with the exception of
`options` and `properties`.  `options` defines command line arguments to be passed to `post`, and
overridding with new options will add those options.  To remove an option, specify `null` as the
value.  Options can be an array when multiple arguments are needed, such as `["-a", "32"]`.
Properties are mapped to post-processor properties, and use a similar approach as options.

When a test runs, the resulting `validators` define what how to manage the results of the execution
so the results can be saved in a snapshot.  There are multiple validators, such as XPath and Text,
that provide their own sets of features.  The XPath validator will always remove all
comments from the file, and then further allows limiting the content to specific XPath queries to
limit the scope of what is validated for any particular test.  The Text validator provides an option
to filter (remove) content from the snapshot based on matching regular expressions.

## Test artifacts

A directory is created for each test execution, in the `results` folder under the working
CNC folder.  The default, for example, would be `tests/cnc/results`.  It is organized first by the
name of the post (such as `tests/cnc/results/laserpost-lightburn`) followed by the name of the test
(converted to lowercase, with dashes as separators).  For example, for the test called 'Test
workspace offsets' for the 'laserpost-lightburn' CPS post, the directory would become
`tests/cnc/results/laserpost-lightburn/test-workspace-offsets`.

The artifacts folder is removed, including all contents, at the start of each test run.

## Test snapshots

Similar to the `results` folder, the `snapshots` folder (in the same parent directory) contains all
the accepted snapshot files (maintained in git).  If a post is changed that results in a failed
snapshot comparison, the solutions are to either adjust the filters (see the `tests.json` file) to
remove the difference from comparison, or to record a new snapshot (after it has been validated).
See the `-?` command for the options to limit the scope of what tests are executed, and to specify
to reset the snapshot contents.

## License

See the [LICENSE](LICENSE) file.
