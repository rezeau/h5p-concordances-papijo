<?php
// Read-only Core implementation; all upload/extraction writes stay in argv[3].
require_once $argv[1] . '/h5p.classes.php';
$directory = $argv[3];
if (file_exists($directory)) throw new RuntimeException('Refusing to reuse validation directory');
mkdir($directory, 0777, true);
$upload = $directory . '/upload.h5p';
copy($argv[2], $upload);
$framework = new class($directory, $upload) {
  public $errors = [];
  public $info = [];
  public function __construct(public $directory, public $upload) {}
  public function getUploadedH5pFolderPath() { return $this->directory . '/unpacked'; }
  public function getUploadedH5pPath() { return $this->upload; }
  public function getWhitelist($library, $content, $extras) { return $content . ($library ? ' ' . $extras : ''); }
  public function t($text, $arguments = []) { return strtr($text, $arguments); }
  public function setErrorMessage($text, $code = null) { $this->errors[] = [$code, $text]; }
  public function setInfoMessage($text) { $this->info[] = $text; }
  public function getLibraryId($name) { return false; }
  public function libraryHasUpgrade($library) { return false; }
};
$core = new class {
  public $disableFileCheck = false;
  public $maxFileSize = 0;
  public $maxTotalSize = 0;
  public $fs;
  public $librariesJsonData;
  public $mainJsonData;
  public $contentJsonData;
  public function mayUpdateLibraries() { return true; }
  public function getLibraryId($library, $name) { return false; }
};
$core->fs = new class {
  public function saveFileFromZip($directory, $name, $stream) {
    $path = $directory . '/' . $name;
    if (!is_dir(dirname($path))) mkdir(dirname($path), 0777, true);
    $output = fopen($path, 'wb');
    stream_copy_to_stream($stream, $output);
    fclose($output);
  }
};
$validator = new H5PValidator($framework, $core);
$valid = $validator->isValidPackage(false, false);
$result = ['valid' => $valid, 'coreApi' => H5PCore::$coreApi,
  'libraryCount' => count($core->librariesJsonData ?? []),
  'errors' => $framework->errors, 'info' => $framework->info,
  'scope' => 'Official H5P package validator with isolated upload adapter; no host installation'];
file_put_contents($directory . '/result.json', json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), PHP_EOL;
exit($valid ? 0 : 1);
