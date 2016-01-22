var Promise = require('bluebird');
var _ = require('underscore');
var AWSMon = require('./AWSMon.js');

var EC2InstanceMon = AWSMon.extend({

    initialize: function(options) {
        var self = this;

        self._aws_product = "EC2";
        self._item_name = 'InstanceId';

        self._ec2_client = Promise.promisifyAll(new self._AWS.EC2());

        // Maps from instance id to most recently fetched information
        // about instance
        self._last_instance_info = {};
    },

    //
    // PUBLIC METHODS
    //

    // Poll the EC2 API and return a list of events and metrics.

    poll: function() {
        var self = this;

        self._logger.info("Polling EC2 Instances...");

        var now = new Date();

        return self._ec2_client.describeInstancesAsync({}).then(function(value) {

            var cur_instance_info = {};

            value.Reservations.forEach(function(reservation) {
                reservation.Instances.forEach(function(instance) {
                    self.remember_aws_item(now, self._item_name, instance.InstanceId);
                    cur_instance_info[instance.InstanceId] = instance;
                });
            });

            var instances = _.values(cur_instance_info);
            var new_metrics = self.demographics(instances,
                                                function(instance) {
                                                    return [{name: "EC2 Instance Type",
                                                             category: instance.InstanceType},
                                                            {name: "EC2 State",
                                                             category: instance.State.Name},
                                                            {name: "EC2 Root Device Type",
                                                             category: instance.RootDeviceType}];
                                                });

            new_metrics.push(self.create_aggregate_metric("EC2 Instance Count", instances.length));

            var new_events = [];

            if (_.keys(self._last_instance_info).length !== 0) {
                new_events = self.changes("EC2 Instance", cur_instance_info, self._last_instance_info);
            }

            self._last_instance_info = cur_instance_info;


            self.age_aws_items(now);

            return {
                events: new_events,
                metrics: new_metrics
            };

        }).error(function(e) {
            self._logger.error("Could not fetch information on EC2 Instances: " + e);
            return {
                events: [],
                metrics: []
            };
        });
    }
});

module.exports = EC2InstanceMon;



