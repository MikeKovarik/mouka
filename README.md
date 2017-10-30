# mouka
🍞 simple, proprietary, fun javascript test framework for comparative testing

Mouka is a Czech word for flour. And it sounds like [mocha](https://github.com/mochajs/mocha) :D


<p align="center">
  <img src="https://raw.githubusercontent.com/MikeKovarik/mouka/master/logo/logo-small.jpg" alt="Mouka test framework"/>
</p>

## what? why?

Don't worry. Mouka does not aspire to be the next big testing framework. It's just a proprietary tool for slightly different way of testing code that would be otherwise hard to test with [mocha](https://github.com/mochajs/mocha).
In my quest for making multiplatform easier I started development of couple of wrappers ([uwp-fs](https://github.com/MikeKovarik/uwp-fs), [uwp-socket](https://github.com/MikeKovarik/uwp-socket) and other unpublished projects) that mimic Node APIs and need to be tested against those APIs. Mocha did not fit my needs so I created this inspired-by-mocha script that eventually outgrew its parent repository when I needed to use this handy testing tool in other repos.

[Mocha](https://github.com/mochajs/mocha) - is a great project for when you are only testing your APIs that is being built from ground up. But testing a project to match already exiting API (Node's `fs`, `stream`, `net`, etc... in this case) means painstakingly creating detailed tests describing every possible scenario based on experimenting in targetted environment.

Mouka - bears similarity to Mocha (`describe` and `it`) but instead of detailing tests with asserts Mouka lets you return values and outputs from tests executed in main environment (Npde), export them to a "What the output should be like" file and then compare it against tests executed in secondary environment (UWP, Browser and whatnot).

TL;DR: Compare outputs of two environments (Node vs Web or UWP) instead of writing convoluted asserts.
