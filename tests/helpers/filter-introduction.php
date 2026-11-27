<?php
// Exercise the installed official validator without loading or changing the CMS.
require $argv[1];
$semantics = json_decode(file_get_contents($argv[2]));
foreach ($semantics as $group) {
  if ($group->name === 'activity') {
    $activity = $group;
    break;
  }
}
foreach ($activity->fields as $field) {
  if ($field->name === 'introduction') {
    $introduction = $field;
    break;
  }
}
$validator = new H5PContentValidator(NULL, NULL);
$values = json_decode(stream_get_contents(STDIN));
foreach ($values as &$value) {
  $validator->validateText($value, clone $introduction);
}
unset($value);
echo json_encode($values);
