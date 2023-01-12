<div align='center' padding-bottom="200px"><img src="https://github.com/nuCarve/laserpost/raw/main/images/nuCarve-logo-color-vert.svg" width="200px" /></div>
&nbsp;  

# [LaserPost](https://nucarve.com/laserpost) Automated Testing

Automated testing is done with a custom test tool that runs the Autodesk `post` executable against a collection of
premade `cnc` files using the LaserPost post-processors.  The tests are located in the `tests` folder, with configuration defined by the `tests.json` file.  To run all tests, execute the command:

```sh
node tests/test.mjs
```

This will attempt to run the Autodesk post-processor (`post.exe` or `post`, depending on your operating system).  If this cannot be found in your path, the tests will fail with errors.  You can use the `-p` option to specify the path to the post processor, such as (Windows style example):

```sh
node tests/test.mjs -p="C:\Users\myname\AppData\Local\Autodesk\webdeploy\production\212ef2a73b4faa7986fe0d205fb521fc68f5f11b\Applications\CAM360\post"
```

All options:
* `-p=<path to post executable>`: Path to the post executable.
* `-c=<path to CNC intermediate files>`: Directory that contains the "cnc" files used for testing.  Defaults to `tests/cnc`.
* `-s=<path to CPS source files>`: Directory that contains the post processor(s) to execute.
  Defaults to `release/dist`.

## Test artifacts

A unique directory is created for each test execution, in a new `results` folder under the working
CNC folder.  The default, for example, would be `tests/cnc/results`.  It is organized first by the
name of the post (such as `tests/cnc/results/laserpost-lightburn`) followed by the name of the test
(converted to lowercase, with dashes as separators).  For example, for the test called 'Test
workspace offsets' for the 'laserpost-lightburn' CPS post, the directory would become
`tests/cnc/results/laserpost-lightburn/test-workspace-offsets`.

The artifacts folder is removed, including all contents, at the start of each test run.

## CNC intermediate files

Models used for testing are defined using Autodesk CAM "intermediate" CNC files.  These start with a
solid model and CAM manufacturing setups and operations, and then are generated using the "Export
CNC file to Visual Studio Code" (`export cnc file to vs code.cps`) post-processor (available on the
[Autodesk CAM Post Library](https://cam.autodesk.com/hsmposts)).  Use the machine setup that is
correct for the post-processor, and change the processor in the post-processor dialog when running
the post.  This way the machine settings remain associated with the machine, even though it is a
 different post processor.  Then locate the generated `.nc` file, and inside that file is the path
 to the folder that contains the required `.cnc` file.  Copy that file into the `tests/cnc` folder
 and configure the `tests.json` file for whatever tests you wish to run using the model.

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

## License

See the [LICENSE](LICENSE) file.
