'use strict';

const NpmTask = require('../../../lib/tasks/npm-task');
const MockUI = require('console-ui/mock');
const expect = require('../../chai').expect;
const td = require('testdouble');
const SilentError = require('silent-error');

describe('NpmTask', function() {
  describe('checkNpmVersion', function() {
    let task, ui, npm;

    beforeEach(function() {
      ui = new MockUI();
      npm = td.function();
      task = new NpmTask({ ui, npm });
    });

    it('resolves when a compatible version is found', function() {
      td.when(npm(['--version'])).thenResolve({ stdout: '3.2.1' });

      return expect(task.checkNpmVersion()).to.be.fulfilled.then(() => {
        expect(ui.output).to.be.empty;
        expect(ui.errors).to.be.empty;
      });
    });

    it('resolves with warning when a newer version is found', function() {
      td.when(npm(['--version'])).thenResolve({ stdout: '5.0.0' });

      return expect(task.checkNpmVersion()).to.be.fulfilled.then(() => {
        expect(ui.output).to.contain('WARNING');
        expect(ui.errors).to.be.empty;
      });
    });

    it('rejects when an older version is found', function() {
      td.when(npm(['--version'])).thenResolve({ stdout: '2.9.9' });

      return expect(task.checkNpmVersion()).to.be.rejectedWith(SilentError, /npm install -g npm/).then(() => {
        expect(ui.output).to.be.empty;
        expect(ui.errors).to.be.empty;
      });
    });

    it('rejects when npm is not found', function() {
      let error = new Error('npm not found');
      error.code = 'ENOENT';

      td.when(npm(['--version'])).thenReject(error);

      return expect(task.checkNpmVersion()).to.be.rejectedWith(SilentError, /instructions at https:\/\/github.com\/npm\/npm/).then(() => {
        expect(ui.output).to.be.empty;
        expect(ui.errors).to.be.empty;
      });
    });

    it('rejects when npm returns an unreadable version', function() {
      td.when(npm(['--version'])).thenResolve({ stdout: '5' });

      return expect(task.checkNpmVersion()).to.be.rejectedWith(TypeError, /Invalid Version/).then(() => {
        expect(ui.output).to.be.empty;
        expect(ui.errors).to.be.empty;
      });
    });

    it('rejects when an unknown error is thrown', function() {
      td.when(npm(['--version'])).thenReject(new Error('foobar?'));

      return expect(task.checkNpmVersion()).to.be.rejectedWith('foobar?').then(() => {
        expect(ui.output).to.be.empty;
        expect(ui.errors).to.be.empty;
      });
    });
  });

  describe('checkYarn', function() {
    let task, ui, yarn;

    beforeEach(function() {
      ui = new MockUI();
      yarn = td.function();
      task = new NpmTask({ ui, yarn });
    });

    it('resolves when yarn is found', function() {
      td.when(yarn(['--version'])).thenResolve({ stdout: '0.22.1' });

      return expect(task.checkYarn()).to.be.fulfilled;
    });

    it('rejects when yarn is not found', function() {
      let error = new Error('yarn not found');
      error.code = 'ENOENT';

      td.when(yarn(['--version'])).thenReject(error);

      return expect(task.checkYarn()).to.be.rejectedWith('yarn not found');
    });

    it('rejects when an unknown error is thrown', function() {
      td.when(yarn(['--version'])).thenReject(new Error('foobar?'));

      return expect(task.checkYarn()).to.be.rejectedWith('foobar?');
    });
  });

  describe('findPackageManager', function() {
    let task;

    beforeEach(function() {
      task = new NpmTask();
    });

    it('resolves when no yarn.lock file was found and npm is compatible', function() {
      task.hasYarnLock = td.function();
      td.when(task.hasYarnLock()).thenReturn(false);

      task.checkNpmVersion = td.function();
      td.when(task.checkNpmVersion()).thenResolve();

      return expect(task.findPackageManager()).to.be.fulfilled;
    });

    it('resolves when no yarn.lock file was found and npm is incompatible', function() {
      task.hasYarnLock = td.function();
      td.when(task.hasYarnLock()).thenReturn(false);

      task.checkNpmVersion = td.function();
      td.when(task.checkNpmVersion()).thenReject();

      return expect(task.findPackageManager()).to.be.rejected;
    });

    it('resolves when yarn.lock file and yarn were found and sets useYarn = true', function() {
      task.hasYarnLock = td.function();
      td.when(task.hasYarnLock()).thenReturn(true);

      task.checkYarn = td.function();
      td.when(task.checkYarn()).thenResolve();

      expect(task.useYarn).to.be.undefined;
      return expect(task.findPackageManager()).to.be.fulfilled.then(() => {
        expect(task.useYarn).to.be.true;
      });
    });

    it('resolves when yarn.lock file was found, yarn was not found and npm is compatible', function() {
      task.hasYarnLock = td.function();
      td.when(task.hasYarnLock()).thenReturn(true);

      task.checkYarn = td.function();
      td.when(task.checkYarn()).thenReject();

      task.checkNpmVersion = td.function();
      td.when(task.checkNpmVersion()).thenResolve();

      expect(task.useYarn).to.be.undefined;
      return expect(task.findPackageManager()).to.be.fulfilled.then(() => {
        expect(task.useYarn).to.not.be.true;
      });
    });

    it('rejects when yarn.lock file was found, yarn was not found and npm is incompatible', function() {
      task.hasYarnLock = td.function();
      td.when(task.hasYarnLock()).thenReturn(true);

      task.checkYarn = td.function();
      td.when(task.checkYarn()).thenReject();

      task.checkNpmVersion = td.function();
      td.when(task.checkNpmVersion()).thenReject();

      return expect(task.findPackageManager()).to.be.rejected;
    });

    it('resolves when yarn is requested and found', function() {
      task.useYarn = true;

      task.checkYarn = td.function();
      td.when(task.checkYarn()).thenResolve();

      return expect(task.findPackageManager()).to.be.fulfilled;
    });

    it('rejects with SilentError when yarn is requested but not found', function() {
      task.useYarn = true;

      let error = new Error('yarn not found');
      error.code = 'ENOENT';

      task.checkYarn = td.function();
      td.when(task.checkYarn()).thenReject(error);

      return expect(task.findPackageManager()).to.be.rejectedWith(SilentError, /Yarn could not be found/);
    });

    it('rejects when yarn is requested and yarn check errors', function() {
      task.useYarn = true;

      task.checkYarn = td.function();
      td.when(task.checkYarn()).thenReject(new Error('foobar'));

      return expect(task.findPackageManager()).to.be.rejectedWith('foobar');
    });

    it('resolves when npm is requested and compatible', function() {
      task.useYarn = false;

      task.checkNpmVersion = td.function();
      td.when(task.checkNpmVersion()).thenResolve();

      return expect(task.findPackageManager()).to.be.fulfilled;
    });

    it('rejects when npm is requested but incompatible', function() {
      task.useYarn = false;

      task.checkNpmVersion = td.function();
      td.when(task.checkNpmVersion()).thenReject();

      return expect(task.findPackageManager()).to.be.rejected;
    });
  });
});
