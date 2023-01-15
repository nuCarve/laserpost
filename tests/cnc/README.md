<div align='center' padding-bottom="200px"><img src="https://github.com/nuCarve/laserpost/raw/main/images/nuCarve-logo-color-vert.svg" width="200px" /></div>
&nbsp;  

# [LaserPost](https://nucarve.com/laserpost) Test Models and Snapshots

This folder contains the control files used to run the automated system testing (see the
[README.md](tests/README.md) file located in the `tests` folder for more informaiton on automated
testing). 

* `*.cnc`: These are Autodesk CNC "Intermediate" files, one for each model.
* `*.f3d`: Fusion 3D solid models, used to generate the `.cnc` files.
* `snapshots`: Baseline snapshots of known-good test executions, used to compare against current
  runs to determine success / failure.
* `results`: This folder is automatically removed and generated on each execution of the tests

# Models

The following models are used for in the automated tests, as defined by the `tests.json` file.  All
of these models have cleared all LaserPost properties (using only defaults) except where specified,
allowing individual tests to set properties as desired.

- `op-1-defaults`: Simple model with one through cutting operation, with WCS at lower-left corner.
- `op-4-cut-modes`: Simple model with four operations (two through cuts using laser 2, one etch on
  laser 1, and one vaporize on laser 1), with WCS at lower-left corner.
- `complex-ll-top`: More complex model, from `complex.f3d`, with multiple operations and grouping,
  operations on the Top plane with WCS set to the lower-left corner.
- `complex-lr-top`:  Same `complex.f3d` on top, with lower-right corner WCS.
- `complex-ul-top`: Same `complex.f3d` on top, with upper-left corner WCS.
- `complex-ur-top`: Same `complex.f3d` on top, with upper-right corner WCS.
- `complex-ll-right`: Same `complex.f3d` model, but using different ops from the right plane with
  lower-left WCS.

## License

See the [LICENSE](LICENSE) file.
