<?php
// Adminer plugin for the course (loaded from plugins-enabled/).
//  - lets the tutorial page embed Adminer in an iframe, but only from the platform origin
//  - pre-fills the password of the local, throw-away "viewer" user so the learner just presses Login
require_once 'plugins/frames.php';

class CeAcademyAdminer extends AdminerFrames {
	function __construct() {
		parent::__construct(false);
	}

	function headers() {
		parent::headers(); // removes X-Frame-Options
		$ancestors = getenv('ADMINER_FRAME_ANCESTORS') ?: 'http://localhost:4000';
		header("Content-Security-Policy: frame-ancestors $ancestors", false); // added next to Adminer's own policy
	}

	function head($dark = null) {
		echo Adminer\script(
			"document.addEventListener('DOMContentLoaded', function () {" .
			"var p = document.querySelector('input[name=\"auth[password]\"]');" .
			"if (p && !p.value) { p.value = 'viewer_pw'; }" .
			"});"
		);
	}
}

return new CeAcademyAdminer();
