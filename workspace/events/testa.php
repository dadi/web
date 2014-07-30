<?php
use Bantam\Rosecomb\Event;

class event_testa extends Event {
	public function __construct($datasources) {
		$testValue = "Hello Event 2";
		$this->context = $testValue;
	}
}
?>
