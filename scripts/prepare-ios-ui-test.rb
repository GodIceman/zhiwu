require 'xcodeproj'

project = Xcodeproj::Project.open('ios/App/App.xcodeproj')
app = project.targets.find { |target| target.name == 'App' }
tests = project.new_target(:ui_test_bundle, 'ValidationUITests', :ios, '16.4')
tests.add_dependency(app)
tests.add_file_references([project.main_group.new_file('ValidationUITests.swift')])
tests.build_configurations.each do |config|
  config.build_settings.merge!({
    'TEST_TARGET_NAME' => 'App', 'PRODUCT_BUNDLE_IDENTIFIER' => 'app.zhiwu.validationUITests',
    'GENERATE_INFOPLIST_FILE' => 'YES', 'SWIFT_VERSION' => '5.0', 'TARGETED_DEVICE_FAMILY' => '1,2'
  })
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.set_launch_target(app)
scheme.add_test_target(tests)
scheme.save_as(project.path, 'Validation', true)
